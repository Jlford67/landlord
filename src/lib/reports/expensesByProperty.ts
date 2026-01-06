import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type ExpensesByPropertyRow = {
  propertyId: string;
  propertyLabel: string;
  transactionalExpense: number;
  annualExpense: number;
  totalExpense: number;
};

export async function getExpensesByProperty(params: {
  userId: string;
  startDate: Date;
  endDate: Date;
  includeTransfers?: boolean;
}): Promise<{
  rows: ExpensesByPropertyRow[];
  totals: {
    transactionalExpense: number;
    annualExpense: number;
    totalExpense: number;
  };
}> {
  const includeTransfers = Boolean(params.includeTransfers);

  let startDate = params.startDate;
  let endDate = params.endDate;
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const endExclusive = addDaysUTC(endDate, 1);

  const allowedCategoryTypes: CategoryType[] = includeTransfers
    ? ["expense", "transfer"]
    : ["expense"];

  const properties = await prisma.property.findMany({
    where: {
      ownerships: { some: { entityId: params.userId } },
    },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  if (properties.length === 0) {
    return {
      rows: [],
      totals: { transactionalExpense: 0, annualExpense: 0, totalExpense: 0 },
    };
  }

  const propertyIds = properties.map((p) => p.id);
  const propertyLabelMap = new Map(
    properties.map((p) => [p.id, propertyLabel(p)])
  );

  const categories = await prisma.category.findMany({
    where: { type: { in: allowedCategoryTypes } },
    select: { id: true },
  });

  const allowedCategoryIds = categories.map((c) => c.id);

  const transactionalByProperty = new Map<string, number>();

  if (allowedCategoryIds.length > 0) {
    const grouped = await prisma.transaction.groupBy({
      by: ["propertyId"],
      where: {
        propertyId: { in: propertyIds },
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        amount: { lt: 0 },
        date: {
          gte: startDate,
          lt: endExclusive,
        },
      },
      _sum: { amount: true },
    });

    grouped.forEach((g) => {
      transactionalByProperty.set(g.propertyId, Number(g._sum.amount ?? 0));
    });
  }

  const annualByProperty = new Map<string, number>();

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const years: number[] = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  if (years.length > 0) {
    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: { in: propertyIds },
        year: { gte: startYear, lte: endYear },
        amount: { lt: 0 },
      },
      select: {
        propertyId: true,
        amount: true,
        year: true,
      },
    });

    for (const row of annualRows) {
      const overlapDays = overlapDaysInYear(startDate, endDate, row.year);
      if (overlapDays <= 0) continue;
      const fraction = overlapDays / daysInYear(row.year);
      const prorated = Number(row.amount ?? 0) * fraction;
      const current = annualByProperty.get(row.propertyId) ?? 0;
      annualByProperty.set(row.propertyId, current + prorated);
    }
  }

  const rows: ExpensesByPropertyRow[] = properties
    .map((p) => {
      const transactionalExpense = transactionalByProperty.get(p.id) ?? 0;
      const annualExpense = annualByProperty.get(p.id) ?? 0;
      const totalExpense = transactionalExpense + annualExpense;

      if (transactionalExpense === 0 && annualExpense === 0) return null;

      return {
        propertyId: p.id,
        propertyLabel: propertyLabelMap.get(p.id) ?? "Property",
        transactionalExpense,
        annualExpense,
        totalExpense,
      };
    })
    .filter((row): row is ExpensesByPropertyRow => Boolean(row));

  rows.sort((a, b) => {
    if (a.totalExpense !== b.totalExpense) return a.totalExpense - b.totalExpense;
    return a.propertyLabel.localeCompare(b.propertyLabel);
  });

  const totals = rows.reduce(
    (acc, cur) => {
      acc.transactionalExpense += cur.transactionalExpense;
      acc.annualExpense += cur.annualExpense;
      acc.totalExpense += cur.totalExpense;
      return acc;
    },
    { transactionalExpense: 0, annualExpense: 0, totalExpense: 0 }
  );

  return { rows, totals };
}

function addDaysUTC(date: Date, days: number) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function daysInYear(year: number) {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / 86_400_000);
}

function overlapDaysInYear(rangeStart: Date, rangeEnd: Date, year: number) {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const start = rangeStart > yearStart ? rangeStart : yearStart;
  const end = rangeEnd < yearEnd ? rangeEnd : yearEnd;
  if (start > end) return 0;

  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
