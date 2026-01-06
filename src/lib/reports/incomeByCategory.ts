import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type IncomeByCategoryInput = {
  start?: string | Date | null;
  end?: string | Date | null;
  propertyId?: string | null;
  includeTransfers?: boolean;
};

export type IncomeByCategoryRow = {
  categoryId: string;
  categoryName: string;
  transactionalIncomeCents: number;
  annualIncomeCents: number;
  totalIncomeCents: number;
};

export type IncomeByCategoryResult = {
  input: {
    startDate: Date;
    endDate: Date;
    start: string;
    end: string;
    propertyId?: string | null;
    includeTransfers: boolean;
  };
  rows: IncomeByCategoryRow[];
  totals: {
    transactionalIncomeCents: number;
    annualIncomeCents: number;
    totalIncomeCents: number;
  };
};

const MS_PER_DAY = 86_400_000;

export function parseYmd(value: string): Date {
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));
}

export function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function endExclusive(endInclusive: Date): Date {
  return new Date(
    Date.UTC(
      endInclusive.getUTCFullYear(),
      endInclusive.getUTCMonth(),
      endInclusive.getUTCDate() + 1
    )
  );
}

export function daysInYear(year: number): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / MS_PER_DAY);
}

export function overlapDaysInclusive(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

export function prorateAnnualForRange(
  year: number,
  amountCents: number,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const overlap = overlapDaysInclusive(rangeStart, rangeEnd, yearStart, yearEnd);
  if (overlap <= 0) return 0;
  return (amountCents * overlap) / daysInYear(year);
}

function normalizeDate(value?: string | Date | null): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return parseYmd(value);
}

export async function getIncomeByCategoryReport(
  input: IncomeByCategoryInput
): Promise<IncomeByCategoryResult> {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const parsedStart = normalizeDate(input.start ?? null);
  const parsedEnd = normalizeDate(input.end ?? null);

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const includeTransfers = Boolean(input.includeTransfers);
  const allowedTypes: CategoryType[] = includeTransfers
    ? ["income", "transfer"]
    : ["income"];

  const categories = await prisma.category.findMany({
    where: { type: { in: allowedTypes } },
    select: { id: true, name: true, type: true },
  });

  if (categories.length === 0) {
    return {
      input: {
        startDate,
        endDate,
        start: toYmd(startDate),
        end: toYmd(endDate),
        propertyId: input.propertyId ?? null,
        includeTransfers,
      },
      rows: [],
      totals: {
        transactionalIncomeCents: 0,
        annualIncomeCents: 0,
        totalIncomeCents: 0,
      },
    };
  }

  const categoryMap = new Map(
    categories.map((c) => [c.id, { name: c.name, type: c.type }])
  );
  const allowedCategoryIds = categories.map((c) => c.id);

  const transactionalMap = new Map<string, number>();

  const endDateExclusive = endExclusive(endDate);

  const transactions = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      propertyId: input.propertyId || undefined,
      categoryId: { in: allowedCategoryIds },
      deletedAt: null,
      date: {
        gte: startDate,
        lt: endDateExclusive,
      },
    },
    _sum: { amount: true },
  });

  for (const tx of transactions) {
    const category = categoryMap.get(tx.categoryId);
    if (!category) continue;
    const rawAmount = Number(tx._sum.amount ?? 0);
    const normalizedAmount =
      category.type === "income" && rawAmount < 0
        ? Math.abs(rawAmount)
        : rawAmount;
    transactionalMap.set(tx.categoryId, normalizedAmount);
  }

  const annualMap = new Map<string, number>();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  if (years.length > 0) {
    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: input.propertyId || undefined,
        categoryId: { in: allowedCategoryIds },
        year: { in: years },
      },
      select: {
        categoryId: true,
        amount: true,
        year: true,
      },
    });

    for (const row of annualRows) {
      const category = categoryMap.get(row.categoryId);
      if (!category) continue;

      const baseAmount = Number(row.amount ?? 0);
      // Annual amounts for income should be positive; if data is negative but the
      // category type is income, flip the sign to keep reporting consistent.
      const normalizedAmount =
        category.type === "income" && baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;

      const prorated = prorateAnnualForRange(
        row.year,
        normalizedAmount,
        startDate,
        endDate
      );

      const current = annualMap.get(row.categoryId) ?? 0;
      annualMap.set(row.categoryId, current + prorated);
    }
  }

  const rows: IncomeByCategoryRow[] = [];

  for (const [categoryId, category] of categoryMap.entries()) {
    const transactionalIncomeCents = transactionalMap.get(categoryId) ?? 0;
    const annualIncomeCents = annualMap.get(categoryId) ?? 0;
    const totalIncomeCents = transactionalIncomeCents + annualIncomeCents;

    if (transactionalIncomeCents === 0 && annualIncomeCents === 0) continue;

    rows.push({
      categoryId,
      categoryName: category.name,
      transactionalIncomeCents,
      annualIncomeCents,
      totalIncomeCents,
    });
  }

  rows.sort((a, b) => {
    if (b.totalIncomeCents !== a.totalIncomeCents) {
      return b.totalIncomeCents - a.totalIncomeCents;
    }
    return a.categoryName.localeCompare(b.categoryName);
  });

  const totals = rows.reduce(
    (acc, row) => {
      acc.transactionalIncomeCents += row.transactionalIncomeCents;
      acc.annualIncomeCents += row.annualIncomeCents;
      acc.totalIncomeCents += row.totalIncomeCents;
      return acc;
    },
    { transactionalIncomeCents: 0, annualIncomeCents: 0, totalIncomeCents: 0 }
  );

  return {
    input: {
      startDate,
      endDate,
      start: toYmd(startDate),
      end: toYmd(endDate),
      propertyId: input.propertyId ?? null,
      includeTransfers,
    },
    rows,
    totals,
  };
}
