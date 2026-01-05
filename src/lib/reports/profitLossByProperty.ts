import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type ProfitLossFilters = {
  propertyId?: string | null;
  startDate: Date;
  endDate: Date;
  includeTransfers?: boolean;
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

export async function getProfitLossByProperty(
  filters: ProfitLossFilters
): Promise<ProfitLossByPropertyResult> {
  const includeTransfers = Boolean(filters.includeTransfers);
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

  const rows: ProfitLossRow[] = grouped.map((g) => {
    const category = categoryMap.get(g.categoryId);
    const property = propertyMap.get(g.propertyId);

    const propertyName = property
      ? propertyLabel({
          nickname: property.nickname,
          street: property.street,
          city: property.city,
          state: property.state,
          zip: property.zip,
        })
      : "Unknown property";

    return {
      propertyId: g.propertyId,
      propertyName,
      categoryId: g.categoryId,
      categoryName: category?.name ?? "Unknown category",
      parentCategoryName: category?.parent?.name ?? null,
      type: (category?.type as CategoryType) ?? "expense",
      count: g._count._all,
      amount: Number(g._sum.amount ?? 0),
    };
  });

  rows.sort((a, b) => {
    if (a.propertyName !== b.propertyName) {
      return a.propertyName.localeCompare(b.propertyName);
    }
    const parentA = a.parentCategoryName ?? "";
    const parentB = b.parentCategoryName ?? "";
    if (parentA !== parentB) {
      return parentA.localeCompare(parentB);
    }
    if (a.categoryName !== b.categoryName) {
      return a.categoryName.localeCompare(b.categoryName);
    }
    return a.type.localeCompare(b.type);
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
