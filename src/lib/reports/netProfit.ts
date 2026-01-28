import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { getProfitLossByProperty } from "@/lib/reports/profitLossByProperty";

export type NetProfitYears = "1" | "3" | "5" | "10" | "15" | "all";

export type NetProfitRow = {
  propertyId: string;
  propertyName: string;
  netProfit: number;
  income?: number;
  expenses?: number;
};

export type YearNetProfitRow = {
  year: number;
  netProfit: number;
  income?: number;
  expenses?: number;
};

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
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

function startForYears(years: NetProfitYears): Date {
  if (years === "all") return new Date(0);
  const count = Number(years);
  const now = todayUtc();
  return new Date(Date.UTC(now.getUTCFullYear() - count, now.getUTCMonth(), now.getUTCDate()));
}

export function getNetProfitRange(years: NetProfitYears): { startDate: Date; endDate: Date } {
  const endDate = todayUtc();
  const startDate = startForYears(years);
  return { startDate, endDate };
}

export async function getNetProfitByProperty({
  years,
}: {
  years: NetProfitYears;
}): Promise<NetProfitRow[]> {
  const { startDate, endDate } = getNetProfitRange(years);
  const report = await getProfitLossByProperty({
    startDate,
    endDate,
    includeTransfers: false,
  });

  const rows = Object.values(report.subtotalsByProperty).map((subtotal) => ({
    propertyId: subtotal.propertyId,
    propertyName: subtotal.propertyName,
    netProfit: subtotal.netTotal,
  }));

  rows.sort((a, b) => {
    if (a.netProfit !== b.netProfit) return b.netProfit - a.netProfit;
    return a.propertyName.localeCompare(b.propertyName);
  });

  return rows;
}

export async function getNetProfitByYearForProperty({
  propertyId,
  years,
}: {
  propertyId: string;
  years: NetProfitYears;
}): Promise<YearNetProfitRow[]> {
  const { startDate, endDate } = getNetProfitRange(years);
  const endExclusive = new Date(
    Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), endDate.getUTCDate() + 1)
  );

  const categories = await prisma.category.findMany({
    where: { type: { in: ["income", "expense"] } },
    select: { id: true, type: true },
  });
  const categoryTypeById = new Map(categories.map((category) => [category.id, category.type]));
  const allowedCategoryIds = categories.map((category) => category.id);

  const totalsByYear = new Map<number, { income: number; expenses: number }>();

  const ensureYear = (year: number) => {
    const existing = totalsByYear.get(year);
    if (existing) return existing;
    const next = { income: 0, expenses: 0 };
    totalsByYear.set(year, next);
    return next;
  };

  if (allowedCategoryIds.length > 0) {
    const transactions = await prisma.transaction.findMany({
      where: {
        propertyId,
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endExclusive,
        },
      },
      select: {
        amount: true,
        date: true,
        categoryId: true,
      },
    });

    for (const tx of transactions) {
      const year = tx.date.getUTCFullYear();
      const bucket = ensureYear(year);
      const amount = Number(tx.amount ?? 0);
      const categoryType = categoryTypeById.get(tx.categoryId);
      if (categoryType === "income") bucket.income += amount;
      if (categoryType === "expense") bucket.expenses += amount;
    }
  }

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();
  const annualRows = await prisma.annualCategoryAmount.findMany({
    where: {
      propertyId,
      year: { gte: startYear, lte: endYear },
      category: { type: { in: ["income", "expense"] } },
    },
    select: {
      amount: true,
      year: true,
      category: { select: { type: true } },
    },
  });

  for (const row of annualRows) {
    const overlapDays = overlapDaysInYear(startDate, endDate, row.year);
    if (overlapDays <= 0) continue;
    const fraction = overlapDays / daysInYear(row.year);
    const amount = Number(row.amount ?? 0) * fraction;
    const bucket = ensureYear(row.year);
    if (row.category.type === "income") bucket.income += amount;
    if (row.category.type === "expense") bucket.expenses += amount;
  }

  let yearsToInclude: number[] = [];
  if (years === "all") {
    yearsToInclude = Array.from(totalsByYear.keys());
  } else {
    for (let year = startYear; year <= endYear; year += 1) {
      yearsToInclude.push(year);
    }
  }

  yearsToInclude.sort((a, b) => b - a);

  return yearsToInclude.map((year) => {
    const bucket = totalsByYear.get(year) ?? { income: 0, expenses: 0 };
    return {
      year,
      income: bucket.income,
      expenses: bucket.expenses,
      netProfit: bucket.income + bucket.expenses,
    };
  });
}

export async function getNetProfitForProperty({
  propertyId,
  years,
}: {
  propertyId: string;
  years: NetProfitYears;
}): Promise<NetProfitRow> {
  const { startDate, endDate } = getNetProfitRange(years);
  const report = await getProfitLossByProperty({
    startDate,
    endDate,
    includeTransfers: false,
    propertyId,
  });

  const subtotal = report.subtotalsByProperty[propertyId];

  if (subtotal) {
    return {
      propertyId,
      propertyName: subtotal.propertyName,
      netProfit: subtotal.netTotal,
      income: subtotal.incomeTotal,
      expenses: subtotal.expenseTotal,
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  return {
    propertyId,
    propertyName: property ? propertyLabel(property) : "Unknown property",
    netProfit: 0,
    income: 0,
    expenses: 0,
  };
}
