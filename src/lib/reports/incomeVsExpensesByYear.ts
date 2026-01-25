import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type IncomeVsExpensesRow = {
  year: number;
  income: number;
  expenses: number;
  net: number;
  expenseBase: number;
  incomeAbove: number;
  expenseOverage: number;
};

export async function getIncomeVsExpensesByYear(args: {
  propertyId?: string;
}): Promise<{ rows: IncomeVsExpensesRow[] }> {
  const [incomeCategories, expenseCategories] = await Promise.all([
    prisma.category.findMany({
      where: { type: "income" },
      select: { id: true },
    }),
    prisma.category.findMany({
      where: { type: "expense" },
      select: { id: true },
    }),
  ]);

  const incomeCategoryIds = incomeCategories.map((category) => category.id);
  const expenseCategoryIds = expenseCategories.map((category) => category.id);

  if (incomeCategoryIds.length === 0 && expenseCategoryIds.length === 0) {
    return { rows: [] };
  }

  const incomeTotalsByYear = new Map<number, number>();
  const expenseTotalsByYear = new Map<number, number>();

  const addTotal = (map: Map<number, number>, year: number, amount: number) => {
    const next = (map.get(year) ?? 0) + amount;
    map.set(year, next);
  };

  if (incomeCategoryIds.length > 0) {
    const annualIncomeRows = await prisma.annualCategoryAmount.findMany({
      where: {
        categoryId: { in: incomeCategoryIds },
        propertyId: args.propertyId || undefined,
      },
      select: {
        year: true,
        amount: true,
      },
    });

    annualIncomeRows.forEach((row) => {
      addTotal(incomeTotalsByYear, row.year, Number(row.amount ?? 0));
    });

    const incomePropertyFilter = args.propertyId
      ? Prisma.sql`AND t.propertyId = ${args.propertyId}`
      : Prisma.sql``;

    const incomeTxRows = await prisma.$queryRaw<
      { year: number; total: number | null }[]
    >(
      Prisma.sql`
        SELECT
          CAST(strftime('%Y', t.date) AS INT) as year,
          SUM(t.amount) as total
        FROM "Transaction" t
        WHERE t.deletedAt IS NULL
          AND t.categoryId IN (${Prisma.join(incomeCategoryIds)})
          ${incomePropertyFilter}
        GROUP BY year
      `
    );

    incomeTxRows.forEach((row) => {
      addTotal(incomeTotalsByYear, row.year, Number(row.total ?? 0));
    });
  }

  if (expenseCategoryIds.length > 0) {
    const annualExpenseRows = await prisma.annualCategoryAmount.findMany({
      where: {
        categoryId: { in: expenseCategoryIds },
        propertyId: args.propertyId || undefined,
      },
      select: {
        year: true,
        amount: true,
      },
    });

    annualExpenseRows.forEach((row) => {
      addTotal(expenseTotalsByYear, row.year, Number(row.amount ?? 0));
    });

    const expensePropertyFilter = args.propertyId
      ? Prisma.sql`AND t.propertyId = ${args.propertyId}`
      : Prisma.sql``;

    const expenseTxRows = await prisma.$queryRaw<
      { year: number; total: number | null }[]
    >(
      Prisma.sql`
        SELECT
          CAST(strftime('%Y', t.date) AS INT) as year,
          SUM(t.amount) as total
        FROM "Transaction" t
        WHERE t.deletedAt IS NULL
          AND t.categoryId IN (${Prisma.join(expenseCategoryIds)})
          ${expensePropertyFilter}
        GROUP BY year
      `
    );

    expenseTxRows.forEach((row) => {
      addTotal(expenseTotalsByYear, row.year, Number(row.total ?? 0));
    });
  }

  const yearsSet = new Set<number>([
    ...incomeTotalsByYear.keys(),
    ...expenseTotalsByYear.keys(),
  ]);

  if (yearsSet.size === 0) {
    return { rows: [] };
  }

  const minYear = Math.min(...yearsSet);
  const maxYear = Math.max(...yearsSet);
  const rows: IncomeVsExpensesRow[] = [];

  for (let year = minYear; year <= maxYear; year += 1) {
    const income = incomeTotalsByYear.get(year) ?? 0;
    const expenses = expenseTotalsByYear.get(year) ?? 0;
    const expenseMagnitude = Math.abs(expenses);
    const net = income - expenseMagnitude;

    rows.push({
      year,
      income,
      expenses,
      net,
      expenseBase: expenseMagnitude,
      incomeAbove: Math.max(income - expenseMagnitude, 0),
      expenseOverage: Math.max(expenseMagnitude - income, 0),
    });
  }

  return { rows };
}
