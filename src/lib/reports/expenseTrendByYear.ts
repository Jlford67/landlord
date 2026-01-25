import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type ExpenseTrendResult = {
  years: number[];
  properties: { id: string; label: string }[];
  seriesRaw: { year: number; [propertyId: string]: number }[];
  seriesDisplay: { year: number; [propertyId: string]: number }[];
};

async function getDescendantCategoryIds(categoryId: string): Promise<string[]> {
  const categories = await prisma.category.findMany({
    select: { id: true, parentId: true },
  });

  const childrenByParent = new Map<string | null, string[]>();
  for (const category of categories) {
    const parentKey = category.parentId ?? null;
    const children = childrenByParent.get(parentKey) ?? [];
    children.push(category.id);
    childrenByParent.set(parentKey, children);
  }

  const visited = new Set<string>();
  const stack = [categoryId];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    const children = childrenByParent.get(current) ?? [];
    children.forEach((child) => stack.push(child));
  }

  return Array.from(visited);
}

export async function getExpenseTrendByYear(args: {
  categoryId: string;
  propertyId?: string;
}): Promise<ExpenseTrendResult> {
  const categoryIdsToInclude = await getDescendantCategoryIds(args.categoryId);

  const properties = await prisma.property.findMany({
    where: args.propertyId ? { id: args.propertyId } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  const propertyEntries = properties.map((p) => ({
    id: p.id,
    label: propertyLabel(p),
  }));

  if (properties.length === 0 || categoryIdsToInclude.length === 0) {
    return {
      years: [],
      properties: propertyEntries,
      seriesRaw: [],
      seriesDisplay: [],
    };
  }

  const propertyIds = properties.map((p) => p.id);
  const totalsByPropertyYear = new Map<string, Map<number, number>>();
  const yearsSet = new Set<number>();

  const addTotal = (propertyId: string, year: number, amount: number) => {
    const byYear = totalsByPropertyYear.get(propertyId) ?? new Map<number, number>();
    const next = (byYear.get(year) ?? 0) + amount;
    byYear.set(year, next);
    totalsByPropertyYear.set(propertyId, byYear);
    yearsSet.add(year);
  };

  const annualRows = await prisma.annualCategoryAmount.findMany({
    where: {
      propertyId: { in: propertyIds },
      categoryId: { in: categoryIdsToInclude },
    },
    select: {
      propertyId: true,
      year: true,
      amount: true,
    },
  });

  annualRows.forEach((row) => {
    addTotal(row.propertyId, row.year, Number(row.amount ?? 0));
  });

  const txRows = await prisma.$queryRaw<
    { propertyId: string; year: number; total: number | null }[]
  >(
    Prisma.sql`
      SELECT
        t.propertyId as propertyId,
        CAST(strftime('%Y', t.date) AS INT) as year,
        SUM(t.amount) as total
      FROM "Transaction" t
      WHERE t.deletedAt IS NULL
        AND t.categoryId IN (${Prisma.join(categoryIdsToInclude)})
        AND t.propertyId IN (${Prisma.join(propertyIds)})
      GROUP BY t.propertyId, year
    `
  );

  txRows.forEach((row) => {
    addTotal(row.propertyId, row.year, Number(row.total ?? 0));
  });

  if (yearsSet.size === 0) {
    return {
      years: [],
      properties: propertyEntries,
      seriesRaw: [],
      seriesDisplay: [],
    };
  }

  const minYear = Math.min(...yearsSet);
  const maxYear = Math.max(...yearsSet);

  const years: number[] = [];
  for (let year = minYear; year <= maxYear; year += 1) {
    years.push(year);
  }

  const seriesRaw = years.map((year) => {
    const row: { year: number; [propertyId: string]: number } = { year };
    propertyIds.forEach((propertyId) => {
      row[propertyId] = totalsByPropertyYear.get(propertyId)?.get(year) ?? 0;
    });
    return row;
  });

  const seriesDisplay = seriesRaw.map((row) => {
    const next: { year: number; [propertyId: string]: number } = { year: row.year };
    propertyIds.forEach((propertyId) => {
      next[propertyId] = Math.abs(row[propertyId] ?? 0);
    });
    return next;
  });

  return {
    years,
    properties: propertyEntries,
    seriesRaw,
    seriesDisplay,
  };
}
