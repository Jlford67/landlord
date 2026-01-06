import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type RentalIncomeByPropertyInput = {
  start?: string | null;
  end?: string | null;
  propertyId?: string | null;
  includeTransfers?: boolean;
  includeOtherIncome?: boolean;
};

export type RentalIncomeByPropertyRow = {
  propertyId: string;
  propertyLabel: string;
  transactionalIncomeCents: number;
  annualIncomeCents: number;
  totalIncomeCents: number;
};

export type RentalIncomeByPropertyReport = {
  input: {
    start: string;
    end: string;
    propertyId?: string | null;
    includeTransfers: boolean;
    includeOtherIncome: boolean;
  };
  rows: RentalIncomeByPropertyRow[];
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

function toYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDate(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  return parseYmd(value);
}

function isRentalIncomeCategory(categoryName: string): boolean {
  const name = categoryName.toLowerCase();
  const includeMatches = ["rent", "rental", "lease"];
  const excludeMatches = [
    "late fee",
    "application",
    "deposit",
    "reimbursement",
    "utility",
    "hoa",
    "laundry",
  ];

  const includes = includeMatches.some((token) => name.includes(token));
  if (!includes) return false;
  const excludes = excludeMatches.some((token) => name.includes(token));
  return !excludes;
}

export async function getRentalIncomeByPropertyReport(
  input: RentalIncomeByPropertyInput
): Promise<RentalIncomeByPropertyReport> {
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
  const includeOtherIncome = Boolean(input.includeOtherIncome);
  const propertyFilter = input.propertyId || undefined;

  const allowedCategoryTypes: CategoryType[] = includeTransfers
    ? ["income", "transfer"]
    : ["income"];

  const [properties, categories] = await Promise.all([
    prisma.property.findMany({
      where: propertyFilter ? { id: propertyFilter } : undefined,
      select: {
        id: true,
        nickname: true,
        street: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
    prisma.category.findMany({
      where: { type: { in: allowedCategoryTypes } },
      select: { id: true, name: true, type: true },
    }),
  ]);

  const propertyLabelMap = new Map(
    properties.map((p) => [p.id, propertyLabel(p)])
  );

  const endDateExclusive = endExclusive(endDate);
  const transactionalByProperty = new Map<string, number>();

  if (categories.length > 0) {
    const allowedCategoryIds = categories.map((c) => c.id);
    const transactions = await prisma.transaction.findMany({
      where: {
        propertyId: propertyFilter,
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endDateExclusive,
        },
      },
      select: {
        propertyId: true,
        amount: true,
        category: { select: { id: true, name: true, type: true } },
      },
    });

    for (const tx of transactions) {
      const category = tx.category;
      if (!category) continue;

      const isIncomeLike =
        category.type === "income" || (includeTransfers && category.type === "transfer");
      if (!isIncomeLike) continue;

      const isRentalCategory =
        category.type === "income" && isRentalIncomeCategory(category.name);
      if (!includeOtherIncome && !isRentalCategory) continue;

      const rawAmount = Number(tx.amount ?? 0);
      // Imported data can invert income signs; normalize to positive for income totals.
      const normalizedAmount = rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;

      const current = transactionalByProperty.get(tx.propertyId) ?? 0;
      transactionalByProperty.set(tx.propertyId, current + normalizedAmount);
    }
  }

  const annualByProperty = new Map<string, number>();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  if (years.length > 0) {
    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: propertyFilter,
        year: { in: years },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        propertyId: true,
        year: true,
        amount: true,
        category: { select: { name: true, type: true } },
      },
    });

    for (const row of annualRows) {
      const category = row.category;
      if (!category) continue;

      const isIncomeLike =
        category.type === "income" || (includeTransfers && category.type === "transfer");
      if (!isIncomeLike) continue;

      const isRentalCategory =
        category.type === "income" && isRentalIncomeCategory(category.name);
      if (!includeOtherIncome && !isRentalCategory) continue;

      const baseAmount = Number(row.amount ?? 0);
      // Annual income should be positive; flip unexpected negatives to keep reporting consistent.
      const normalizedAmount = baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;

      const prorated = prorateAnnualForRange(
        row.year,
        normalizedAmount,
        startDate,
        endDate
      );

      if (prorated === 0) continue;

      const current = annualByProperty.get(row.propertyId) ?? 0;
      annualByProperty.set(row.propertyId, current + prorated);
    }
  }

  const propertyIds = new Set<string>();
  transactionalByProperty.forEach((_, pid) => propertyIds.add(pid));
  annualByProperty.forEach((_, pid) => propertyIds.add(pid));

  const rows: RentalIncomeByPropertyRow[] = Array.from(propertyIds).map((pid) => {
    const transactionalIncomeCents = transactionalByProperty.get(pid) ?? 0;
    const annualIncomeCents = annualByProperty.get(pid) ?? 0;
    const totalIncomeCents = transactionalIncomeCents + annualIncomeCents;

    return {
      propertyId: pid,
      propertyLabel: propertyLabelMap.get(pid) ?? "Property",
      transactionalIncomeCents,
      annualIncomeCents,
      totalIncomeCents,
    };
  });

  rows.sort((a, b) => {
    if (b.totalIncomeCents !== a.totalIncomeCents) {
      return b.totalIncomeCents - a.totalIncomeCents;
    }
    return a.propertyLabel.localeCompare(b.propertyLabel);
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
      start: toYmd(startDate),
      end: toYmd(endDate),
      propertyId: input.propertyId ?? null,
      includeTransfers,
      includeOtherIncome,
    },
    rows,
    totals,
  };
}
