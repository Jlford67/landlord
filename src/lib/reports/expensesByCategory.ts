import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type ExpensesByCategoryFilters = {
  propertyId?: string | null;
  startDate: Date;
  endDate: Date;
  includeTransfers?: boolean;
};

export type ExpensesByCategoryRow = {
  id: string;
  name: string;
  depth: number;
  amount: number;
};

export type ExpensesByCategoryResult = {
  rows: ExpensesByCategoryRow[];
  total: number;
};

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

export async function getExpensesByCategoryReport(
  filters: ExpensesByCategoryFilters
): Promise<ExpensesByCategoryResult> {
  const includeTransfers = Boolean(filters.includeTransfers);
  const endExclusive = addDaysUTC(filters.endDate, 1);

  const allowedTypes: CategoryType[] = includeTransfers
    ? ["expense", "transfer"]
    : ["expense"];

  const categories = await prisma.category.findMany({
    where: { type: { in: allowedTypes } },
    select: {
      id: true,
      name: true,
      parentId: true,
      type: true,
    },
  });

  const categoryMap = new Map(
    categories.map((c) => [c.id, { id: c.id, name: c.name, parentId: c.parentId }])
  );

  const allowedCategoryIds = categories.map((c) => c.id);

  if (allowedCategoryIds.length === 0) {
    return { rows: [], total: 0 };
  }

  const grouped = await prisma.transaction.groupBy({
    by: ["categoryId"],
    where: {
      propertyId: filters.propertyId || undefined,
      categoryId: { in: allowedCategoryIds },
      deletedAt: null,
      date: {
        gte: filters.startDate,
        lt: endExclusive,
      },
    },
    _sum: { amount: true },
  });

  const directAmounts = new Map<string, number>();
  grouped.forEach((g) => {
    directAmounts.set(g.categoryId, Number(g._sum.amount ?? 0));
  });

  const startYear = filters.startDate.getUTCFullYear();
  const endYear = filters.endDate.getUTCFullYear();
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
        categoryId: true,
        amount: true,
        year: true,
      },
    });

    for (const row of annualRows) {
      const overlapDays = overlapDaysInYear(filters.startDate, filters.endDate, row.year);
      if (overlapDays <= 0) continue;
      const fraction = overlapDays / daysInYear(row.year);
      const proratedAmount = Number(row.amount ?? 0) * fraction;
      const current = directAmounts.get(row.categoryId) ?? 0;
      directAmounts.set(row.categoryId, current + proratedAmount);
    }
  }

  const childrenMap = new Map<string | null, string[]>();
  categories.forEach((cat) => {
    const key = cat.parentId ?? null;
    const arr = childrenMap.get(key) ?? [];
    arr.push(cat.id);
    childrenMap.set(key, arr);
  });

  function sortByName(ids: string[]) {
    return ids.sort((a, b) => {
      const nameA = categoryMap.get(a)?.name ?? "";
      const nameB = categoryMap.get(b)?.name ?? "";
      return nameA.localeCompare(nameB);
    });
  }

  const memoTotals = new Map<string, number>();
  function totalFor(categoryId: string): number {
    const cached = memoTotals.get(categoryId);
    if (cached !== undefined) return cached;

    const direct = directAmounts.get(categoryId) ?? 0;
    const children = childrenMap.get(categoryId) ?? [];
    const childTotal = children.reduce((sum, id) => sum + totalFor(id), 0);
    const total = direct + childTotal;
    memoTotals.set(categoryId, total);
    return total;
  }

  const rows: ExpensesByCategoryRow[] = [];

  function addRows(categoryId: string, depth: number) {
    const category = categoryMap.get(categoryId);
    if (!category) return;

    const total = totalFor(categoryId);
    if (total === 0) return;

    rows.push({
      id: category.id,
      name: category.name,
      depth,
      amount: total,
    });

    const children = sortByName(childrenMap.get(categoryId) ?? []);
    children.forEach((childId) => addRows(childId, depth + 1));
  }

  const rootIds = sortByName(
    categories
      .filter((cat) => !cat.parentId || !categoryMap.has(cat.parentId))
      .map((cat) => cat.id)
  );
  rootIds.forEach((id) => addRows(id, 0));

  const total = Array.from(directAmounts.values()).reduce((sum, amt) => sum + amt, 0);

  return { rows, total };
}
