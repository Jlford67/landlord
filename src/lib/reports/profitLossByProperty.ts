import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type ProfitLossFilters = {
  propertyId?: string | null;
  startDate: Date;
  endDate: Date;
  includeTransfers?: boolean;
  includeAnnualTotals?: boolean;
};

export type ProfitLossRow = {
  propertyId: string;
  propertyName: string;
  categoryId: string;
  categoryName: string;
  parentCategoryName: string | null;
  type: CategoryType;
  count: number;
  amount: number;
};

export type ProfitLossTotals = {
  incomeTotal: number;
  expenseTotal: number;
  netTotal: number;
};

export type ProfitLossByPropertyResult = {
  rows: ProfitLossRow[];
  subtotalsByProperty: Record<
    string,
    ProfitLossTotals & { propertyId: string; propertyName: string }
  >;
  totals: ProfitLossTotals;
};

function addDaysUTC(d: Date, days: number) {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + days)
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

export async function getProfitLossByProperty(
  filters: ProfitLossFilters
): Promise<ProfitLossByPropertyResult> {
  const includeTransfers = Boolean(filters.includeTransfers);
  const includeAnnualTotals = filters.includeAnnualTotals ?? true;
  const startDate = filters.startDate;
  const endDate = filters.endDate;

  const endExclusive = addDaysUTC(endDate, 1);

  const [categories, properties] = await Promise.all([
    prisma.category.findMany({
      select: {
        id: true,
        name: true,
        type: true,
        parentId: true,
        parent: { select: { id: true, name: true } },
      },
    }),
    prisma.property.findMany({
      select: {
        id: true,
        nickname: true,
        street: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
  ]);

  const categoryMap = new Map(
    categories.map((c) => [c.id, c])
  );
  const propertyMap = new Map(
    properties.map((p) => [p.id, p])
  );

  const allowedCategoryIds = categories
    .filter((c) => includeTransfers || c.type !== "transfer")
    .map((c) => c.id);

  if (allowedCategoryIds.length === 0) {
    return {
      rows: [],
      subtotalsByProperty: {},
      totals: { incomeTotal: 0, expenseTotal: 0, netTotal: 0 },
    };
  }

  const grouped = await prisma.transaction.groupBy({
    by: ["propertyId", "categoryId"],
    where: {
      propertyId: filters.propertyId || undefined,
      categoryId: { in: allowedCategoryIds },
      deletedAt: null,
      date: {
        gte: startDate,
        lt: endExclusive,
      },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const rowMap = new Map<string, ProfitLossRow>();

  function upsertRow(input: {
    propertyId: string;
    categoryId: string;
    amount: number;
    count: number;
  }) {
    const category = categoryMap.get(input.categoryId);
    const property = propertyMap.get(input.propertyId);

    const propertyName = property
      ? propertyLabel({
          nickname: property.nickname,
          street: property.street,
          city: property.city,
          state: property.state,
          zip: property.zip,
        })
      : "Unknown property";

    const key = `${input.propertyId}__${input.categoryId}`;
    const existing = rowMap.get(key);

    if (existing) {
      existing.amount += input.amount;
      existing.count += input.count;
      return;
    }

    rowMap.set(key, {
      propertyId: input.propertyId,
      propertyName,
      categoryId: input.categoryId,
      categoryName: category?.name ?? "Unknown category",
      parentCategoryName: category?.parent?.name ?? null,
      type: (category?.type as CategoryType) ?? "expense",
      count: input.count,
      amount: input.amount,
    });
  }

  grouped.forEach((g) => {
    upsertRow({
      propertyId: g.propertyId,
      categoryId: g.categoryId,
      amount: Number(g._sum.amount ?? 0),
      count: g._count._all,
    });
  });

  if (includeAnnualTotals) {
    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();
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
        const overlapDays = overlapDaysInYear(startDate, endDate, row.year);
        if (overlapDays <= 0) continue;
        const fraction = overlapDays / daysInYear(row.year);
        const proratedAmount = Number(row.amount ?? 0) * fraction;

        upsertRow({
          propertyId: row.propertyId,
          categoryId: row.categoryId,
          amount: proratedAmount,
          count: 0,
        });
      }
    }
  }

  const rows = Array.from(rowMap.values());

  const typeRank: Record<string, number> = { income: 0, expense: 1, transfer: 2 };

  rows.sort((a, b) => {
    if (a.propertyName !== b.propertyName) {
      return a.propertyName.localeCompare(b.propertyName);
    }

    const rankA = typeRank[a.type] ?? 99;
    const rankB = typeRank[b.type] ?? 99;
    if (rankA !== rankB) return rankA - rankB;

    const parentA = (a.parentCategoryName ?? "").toLowerCase();
    const parentB = (b.parentCategoryName ?? "").toLowerCase();
    if (parentA !== parentB) return parentA.localeCompare(parentB);

    const nameA = a.categoryName.toLowerCase();
    const nameB = b.categoryName.toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const subtotalsByProperty: ProfitLossByPropertyResult["subtotalsByProperty"] =
    {};

  for (const row of rows) {
    const current = subtotalsByProperty[row.propertyId] ?? {
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      incomeTotal: 0,
      expenseTotal: 0,
      netTotal: 0,
    };

    if (row.type === "income") current.incomeTotal += row.amount;
    if (row.type === "expense") current.expenseTotal += row.amount;
    current.netTotal = current.incomeTotal + current.expenseTotal;

    subtotalsByProperty[row.propertyId] = current;
  }

  const totals = Object.values(subtotalsByProperty).reduce(
    (acc, cur) => {
      acc.incomeTotal += cur.incomeTotal;
      acc.expenseTotal += cur.expenseTotal;
      acc.netTotal += cur.netTotal;
      return acc;
    },
    { incomeTotal: 0, expenseTotal: 0, netTotal: 0 }
  );

  return { rows, subtotalsByProperty, totals };
}
