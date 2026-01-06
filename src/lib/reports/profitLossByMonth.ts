import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";

type ProfitLossByMonthFilters = {
  propertyId?: string | null;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  includeTransfers?: boolean;
  includeAnnualTotals?: boolean;
};

export type ProfitLossByMonthRow = {
  month: string; // YYYY-MM
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
};

export type ProfitLossByMonthResult = {
  months: ProfitLossByMonthRow[];
  totals: {
    incomeTotal: number;
    expenseTotal: number;
    netTotal: number;
  };
};

function parseDateUTC(value: string) {
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));
}

function startOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function addMonthsUTC(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

function addDaysUTC(date: Date, days: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
}

function monthKey(date: Date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getProfitLossByMonth(
  filters: ProfitLossByMonthFilters
): Promise<ProfitLossByMonthResult> {
  const includeTransfers = Boolean(filters.includeTransfers);
  const includeAnnualTotals = filters.includeAnnualTotals ?? true;

  let startDate = parseDateUTC(filters.startDate);
  let endDate = parseDateUTC(filters.endDate);

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const normalizedStart = startOfMonthUTC(startDate);
  const normalizedEnd = startOfMonthUTC(endDate);

  const allowedCategories = await prisma.category.findMany({
    select: { id: true, type: true },
  });

  const allowedCategoryIds = allowedCategories
    .filter((c) => includeTransfers || c.type !== "transfer")
    .map((c) => c.id);

  const categoryTypeMap = new Map(allowedCategories.map((c) => [c.id, c.type]));

  if (allowedCategoryIds.length === 0) {
    return {
      months: [],
      totals: { incomeTotal: 0, expenseTotal: 0, netTotal: 0 },
    };
  }

  const monthMap = new Map<string, ProfitLossByMonthRow>();
  for (
    let cursor = normalizedStart;
    cursor <= normalizedEnd;
    cursor = addMonthsUTC(cursor, 1)
  ) {
    const key = monthKey(cursor);
    monthMap.set(key, {
      month: key,
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
    });
  }

  const endExclusive = addDaysUTC(endDate, 1);

  const transactions = await prisma.transaction.findMany({
    where: {
      propertyId: filters.propertyId || undefined,
      categoryId: { in: allowedCategoryIds },
      deletedAt: null,
      date: {
        gte: startDate,
        lt: endExclusive,
      },
    },
    select: {
      date: true,
      amount: true,
      categoryId: true,
    },
  });

  for (const tx of transactions) {
    const key = monthKey(tx.date);
    const bucket = monthMap.get(key);
    if (!bucket) continue;

    const type = categoryTypeMap.get(tx.categoryId) ?? "expense";
    if (type === "income") {
      bucket.incomeTotal += Number(tx.amount ?? 0);
    } else if (type === "expense") {
      bucket.expenseTotal += Number(tx.amount ?? 0);
    }

    bucket.netTotal = bucket.incomeTotal + bucket.expenseTotal;
  }

  if (includeAnnualTotals) {
    const startYear = normalizedStart.getUTCFullYear();
    const endYear = normalizedEnd.getUTCFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y++) years.push(y);

    if (years.length > 0) {
      const annualRows = await prisma.annualCategoryAmount.findMany({
        where: {
          propertyId: filters.propertyId || undefined,
          categoryId: { in: allowedCategoryIds },
          year: { in: years },
        },
        select: {
          propertyId: true,
          categoryId: true,
          amount: true,
          year: true,
        },
      });

      for (const row of annualRows) {
        const monthlyShare = Number(row.amount ?? 0) / 12;
        const yearStart = new Date(Date.UTC(row.year, 0, 1));
        const yearEnd = new Date(Date.UTC(row.year, 11, 1));

        const rangeStart = normalizedStart > yearStart ? normalizedStart : yearStart;
        const rangeEnd = normalizedEnd < yearEnd ? normalizedEnd : yearEnd;

        for (
          let cursor = rangeStart;
          cursor <= rangeEnd;
          cursor = addMonthsUTC(cursor, 1)
        ) {
          const key = monthKey(cursor);
          const bucket = monthMap.get(key);
          if (!bucket) continue;

          const type = categoryTypeMap.get(row.categoryId) as CategoryType | undefined;
          if (type === "income") {
            bucket.incomeTotal += monthlyShare;
          } else if (type === "expense") {
            bucket.expenseTotal += monthlyShare;
          }

          bucket.netTotal = bucket.incomeTotal + bucket.expenseTotal;
        }
      }
    }
  }

  const months = Array.from(monthMap.values()).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  const totals = months.reduce(
    (acc, cur) => {
      acc.incomeTotal += cur.incomeTotal;
      acc.expenseTotal += cur.expenseTotal;
      acc.netTotal += cur.netTotal;
      return acc;
    },
    { incomeTotal: 0, expenseTotal: 0, netTotal: 0 }
  );

  return { months, totals };
}
