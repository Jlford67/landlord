import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type AnnualProfitAndLossSummaryFilters = {
  propertyId?: string | null;
  startYear: number;
  endYear: number;
  includeTransfers?: boolean;
};

export type AnnualCategorySummaryRow = {
  categoryId: string;
  name: string;
  type: CategoryType;
  amount: number;
  depth: number;
};

export type AnnualProfitAndLossYear = {
  year: number;
  incomeTotal: number;
  expenseTotal: number;
  transferTotal: number;
  netTotal: number;
  categories: AnnualCategorySummaryRow[];
};

export type AnnualProfitAndLossSummaryResult = {
  years: AnnualProfitAndLossYear[];
  totals: {
    incomeTotal: number;
    expenseTotal: number;
    transferTotal: number;
    netTotal: number;
  };
};

type CategoryRecord = {
  id: string;
  name: string;
  type: CategoryType;
  parentId: string | null;
};

function buildYearRange(startYear: number, endYear: number) {
  const start = Math.min(startYear, endYear);
  const end = Math.max(startYear, endYear);
  const years: number[] = [];
  for (let y = start; y <= end; y++) years.push(y);
  return years;
}

function startOfYearUTC(year: number) {
  return new Date(Date.UTC(year, 0, 1));
}

function startOfFollowingYearUTC(year: number) {
  return new Date(Date.UTC(year + 1, 0, 1));
}

export async function getAnnualProfitAndLossSummary(
  filters: AnnualProfitAndLossSummaryFilters
): Promise<AnnualProfitAndLossSummaryResult> {
  const includeTransfers = Boolean(filters.includeTransfers);

  const years = buildYearRange(filters.startYear, filters.endYear);
  if (years.length === 0) {
    return {
      years: [],
      totals: { incomeTotal: 0, expenseTotal: 0, transferTotal: 0, netTotal: 0 },
    };
  }

  const [categories] = await Promise.all([
    prisma.category.findMany({
      select: { id: true, name: true, type: true, parentId: true },
    }),
  ]);

  const allowedCategories = categories.filter(
    (c) => includeTransfers || c.type !== "transfer"
  );
  const allowedCategoryIds = allowedCategories.map((c) => c.id);
  const allowedCategorySet = new Set(allowedCategoryIds);

  if (allowedCategoryIds.length === 0) {
    return {
      years: [],
      totals: { incomeTotal: 0, expenseTotal: 0, transferTotal: 0, netTotal: 0 },
    };
  }

  const categoryMap = new Map<string, CategoryRecord>(
    allowedCategories.map((c) => [c.id, { ...c, parentId: c.parentId ?? null }])
  );

  const childrenByParent = new Map<string | null, string[]>();
  for (const cat of allowedCategories) {
    const parentId = cat.parentId && allowedCategorySet.has(cat.parentId)
      ? cat.parentId
      : null;
    const arr = childrenByParent.get(parentId) ?? [];
    arr.push(cat.id);
    childrenByParent.set(parentId, arr);
  }

  const amountByYearAndCategory = new Map<number, Map<string, number>>();
  for (const year of years) {
    amountByYearAndCategory.set(year, new Map());
  }

  const startDate = startOfYearUTC(years[0]);
  const endExclusive = startOfFollowingYearUTC(years[years.length - 1]);

  const [transactions, annualAmounts] = await Promise.all([
    prisma.transaction.findMany({
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
    }),
    prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: filters.propertyId || undefined,
        categoryId: { in: allowedCategoryIds },
        year: { in: years },
      },
      select: {
        year: true,
        categoryId: true,
        amount: true,
      },
    }),
  ]);

  function upsertAmount(year: number, categoryId: string, delta: number) {
    const yearMap = amountByYearAndCategory.get(year);
    if (!yearMap) return;
    const current = yearMap.get(categoryId) ?? 0;
    yearMap.set(categoryId, current + delta);
  }

  for (const tx of transactions) {
    const year = tx.date.getUTCFullYear();
    if (!amountByYearAndCategory.has(year)) continue;
    upsertAmount(year, tx.categoryId, Number(tx.amount ?? 0));
  }

  for (const row of annualAmounts) {
    upsertAmount(row.year, row.categoryId, Number(row.amount ?? 0));
  }

  function computeTotalsForYear(year: number) {
    const directMap = amountByYearAndCategory.get(year) ?? new Map<string, number>();
    const totals = {
      incomeTotal: 0,
      expenseTotal: 0,
      transferTotal: 0,
      netTotal: 0,
    };

    for (const [categoryId, amount] of directMap.entries()) {
      const cat = categoryMap.get(categoryId);
      if (!cat) continue;
      if (cat.type === "income") totals.incomeTotal += amount;
      else if (cat.type === "expense") totals.expenseTotal += amount;
      else totals.transferTotal += amount;
    }

    totals.netTotal = totals.incomeTotal + totals.expenseTotal;
    return totals;
  }

  function buildCategoryRows(year: number): AnnualCategorySummaryRow[] {
    const directMap = amountByYearAndCategory.get(year) ?? new Map<string, number>();
    const totalCache = new Map<string, number>();

    function computeAggregate(categoryId: string): number {
      if (totalCache.has(categoryId)) return totalCache.get(categoryId) ?? 0;
      const direct = directMap.get(categoryId) ?? 0;
      const children = childrenByParent.get(categoryId) ?? [];
      const childSum = children.reduce((sum, childId) => sum + computeAggregate(childId), 0);
      const total = direct + childSum;
      totalCache.set(categoryId, total);
      return total;
    }

    function addRows(categoryId: string, depth: number, acc: AnnualCategorySummaryRow[]) {
      const total = computeAggregate(categoryId);
      if (Math.abs(total) < 1e-9) return;

      const cat = categoryMap.get(categoryId);
      if (!cat) return;

      acc.push({
        categoryId,
        name: cat.name,
        type: cat.type,
        amount: total,
        depth,
      });

      const children = [...(childrenByParent.get(categoryId) ?? [])].sort((a, b) => {
        const nameA = categoryMap.get(a)?.name ?? "";
        const nameB = categoryMap.get(b)?.name ?? "";
        return nameA.localeCompare(nameB);
      });

      for (const childId of children) {
        addRows(childId, depth + 1, acc);
      }
    }

    const roots = [...(childrenByParent.get(null) ?? [])].sort((a, b) => {
      const nameA = categoryMap.get(a)?.name ?? "";
      const nameB = categoryMap.get(b)?.name ?? "";
      return nameA.localeCompare(nameB);
    });

    const rows: AnnualCategorySummaryRow[] = [];
    for (const rootId of roots) {
      addRows(rootId, 0, rows);
    }

    return rows;
  }

  const yearsResult: AnnualProfitAndLossYear[] = years.map((year) => {
    const totals = computeTotalsForYear(year);
    return {
      year,
      ...totals,
      categories: buildCategoryRows(year),
    };
  });

  const totals = yearsResult.reduce(
    (acc, cur) => {
      acc.incomeTotal += cur.incomeTotal;
      acc.expenseTotal += cur.expenseTotal;
      acc.transferTotal += cur.transferTotal;
      acc.netTotal += cur.netTotal;
      return acc;
    },
    { incomeTotal: 0, expenseTotal: 0, transferTotal: 0, netTotal: 0 }
  );

  return { years: yearsResult, totals };
}
