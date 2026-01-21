import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";

export type CashVsAccrualPLInput = {
  start: string;
  end: string;
  propertyId?: string | null;
  includeTransfers?: boolean;
  view?: "summary" | "byCategory";
};

export type Totals = {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type CategoryRow = {
  categoryId: string;
  categoryName: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type CashVsAccrualPLReport = {
  input: {
    start: string;
    end: string;
    propertyId?: string | null;
    includeTransfers: boolean;
    view: "summary" | "byCategory";
    accrualMode: "real" | "fallback";
  };
  cash: {
    totals: Totals;
    byCategory?: CategoryRow[];
    breakdown: {
      transactionalIncomeCents: number;
      transactionalExpenseCents: number;
      annualIncomeCents: number;
      annualExpenseCents: number;
    };
  };
  accrual: {
    totals: Totals;
    byCategory?: CategoryRow[];
    breakdown: {
      transactionalIncomeCents: number;
      transactionalExpenseCents: number;
      annualIncomeCents: number;
      annualExpenseCents: number;
    };
  };
  delta: Totals;
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

export function sumIncomeExpense(amountCents: number, type: CategoryType): {
  incomeCentsDelta: number;
  expenseCentsDelta: number;
} {
  if (type === "income") {
    const val = Math.abs(amountCents);
    return { incomeCentsDelta: val, expenseCentsDelta: 0 };
  }

  if (type === "expense") {
    const val = -Math.abs(amountCents);
    return { incomeCentsDelta: 0, expenseCentsDelta: val };
  }

  if (amountCents >= 0) {
    return { incomeCentsDelta: Math.abs(amountCents), expenseCentsDelta: 0 };
  }

  return { incomeCentsDelta: 0, expenseCentsDelta: -Math.abs(amountCents) };
}

function formatYmd(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function normalizeDate(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  return parseYmd(value);
}

function monthKey(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function listMonthsInclusive(start: Date, end: Date): string[] {
  const months: string[] = [];
  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
  const endMonth = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));

  while (cursor <= endMonth) {
    months.push(monthKey(cursor));
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months;
}

export async function getCashVsAccrualPLReport(
  input: CashVsAccrualPLInput
): Promise<CashVsAccrualPLReport> {
  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const parsedStart = normalizeDate(input.start) ?? defaultStart;
  const parsedEnd = normalizeDate(input.end) ?? defaultEnd;

  let startDate = parsedStart;
  let endDate = parsedEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const includeTransfers = Boolean(input.includeTransfers);
  const endDateExclusive = endExclusive(endDate);
  const monthsInRange = listMonthsInclusive(startDate, endDate);

  const categories = await prisma.category.findMany({
    select: { id: true, name: true, type: true },
  });

  const allowedCategories = categories.filter(
    (c) => includeTransfers || c.type !== "transfer"
  );

  if (allowedCategories.length === 0) {
    const emptyTotals: Totals = { incomeCents: 0, expenseCents: 0, netCents: 0 };
    return {
      input: {
        start: formatYmd(startDate),
        end: formatYmd(endDate),
        propertyId: input.propertyId ?? null,
        includeTransfers,
        view: input.view === "byCategory" ? "byCategory" : "summary",
        accrualMode: "fallback",
      },
      cash: {
        totals: emptyTotals,
        byCategory: input.view === "byCategory" ? [] : undefined,
        breakdown: {
          transactionalIncomeCents: 0,
          transactionalExpenseCents: 0,
          annualIncomeCents: 0,
          annualExpenseCents: 0,
        },
      },
      accrual: {
        totals: emptyTotals,
        byCategory: input.view === "byCategory" ? [] : undefined,
        breakdown: {
          transactionalIncomeCents: 0,
          transactionalExpenseCents: 0,
          annualIncomeCents: 0,
          annualExpenseCents: 0,
        },
      },
      delta: emptyTotals,
    };
  }

  const categoryMap = new Map(
    allowedCategories.map((c) => [c.id, { name: c.name, type: c.type }])
  );
  const allowedCategoryIds = allowedCategories.map((c) => c.id);

  const [cashTransactions, accrualTransactions, annualRows] = await Promise.all([
    prisma.transaction.findMany({
      where: {
        propertyId: input.propertyId || undefined,
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        date: { gte: startDate, lt: endDateExclusive },
      },
      select: {
        amount: true,
        categoryId: true,
        statementMonth: true,
      },
    }),
    prisma.transaction.findMany({
      where: {
        propertyId: input.propertyId || undefined,
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        OR: [
          { statementMonth: { in: monthsInRange } },
          { statementMonth: null, date: { gte: startDate, lt: endDateExclusive } },
        ],
      },
      select: {
        amount: true,
        categoryId: true,
        statementMonth: true,
      },
    }),
    prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: input.propertyId || undefined,
        categoryId: { in: allowedCategoryIds },
        year: { in: (() => {
          const years: number[] = [];
          for (let y = startDate.getUTCFullYear(); y <= endDate.getUTCFullYear(); y++) {
            years.push(y);
          }
          return years;
        })() },
      },
      select: {
        year: true,
        amount: true,
        categoryId: true,
      },
    }),
  ]);

  const hasAccrualFieldData = accrualTransactions.some((tx) => !!tx.statementMonth);

  const cashCategoryTotals = new Map<string, { incomeCents: number; expenseCents: number }>();
  const accrualCategoryTotals = new Map<
    string,
    { incomeCents: number; expenseCents: number }
  >();

  const cashBreakdown = {
    transactionalIncomeCents: 0,
    transactionalExpenseCents: 0,
    annualIncomeCents: 0,
    annualExpenseCents: 0,
  };

  const accrualBreakdown = {
    transactionalIncomeCents: 0,
    transactionalExpenseCents: 0,
    annualIncomeCents: 0,
    annualExpenseCents: 0,
  };

  function addCategoryTotals(
    map: Map<string, { incomeCents: number; expenseCents: number }>,
    categoryId: string,
    incomeDelta: number,
    expenseDelta: number
  ) {
    const existing = map.get(categoryId) ?? { incomeCents: 0, expenseCents: 0 };
    map.set(categoryId, {
      incomeCents: existing.incomeCents + incomeDelta,
      expenseCents: existing.expenseCents + expenseDelta,
    });
  }

  function applyTransaction(
    txAmount: number,
    categoryId: string,
    target: "cash" | "accrual"
  ) {
    const category = categoryMap.get(categoryId);
    if (!category) return;
    const { incomeCentsDelta, expenseCentsDelta } = sumIncomeExpense(txAmount, category.type);
    const breakdown = target === "cash" ? cashBreakdown : accrualBreakdown;
    if (target === "cash") {
      addCategoryTotals(cashCategoryTotals, categoryId, incomeCentsDelta, expenseCentsDelta);
    } else {
      addCategoryTotals(
        accrualCategoryTotals,
        categoryId,
        incomeCentsDelta,
        expenseCentsDelta
      );
    }
    if (incomeCentsDelta !== 0) breakdown.transactionalIncomeCents += incomeCentsDelta;
    if (expenseCentsDelta !== 0) breakdown.transactionalExpenseCents += expenseCentsDelta;
  }

  for (const tx of cashTransactions) {
    applyTransaction(Number(tx.amount ?? 0), tx.categoryId, "cash");
  }

  for (const tx of accrualTransactions) {
    applyTransaction(Number(tx.amount ?? 0), tx.categoryId, "accrual");
  }

  for (const row of annualRows) {
    const category = categoryMap.get(row.categoryId);
    if (!category) continue;

    const baseAmount = Number(row.amount ?? 0);
    const normalizedAmount =
      category.type === "income" && baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;

    const prorated = prorateAnnualForRange(
      row.year,
      normalizedAmount,
      startDate,
      endDate
    );

    let incomeCentsDelta = 0;
    let expenseCentsDelta = 0;
    if (category.type === "expense") {
      // AnnualCategoryAmount for expense categories may be negative (expense) or positive (refund).
      // Both must be included so refunds reduce expenses.
      expenseCentsDelta = prorated;
    } else {
      ({ incomeCentsDelta, expenseCentsDelta } = sumIncomeExpense(
        prorated,
        category.type
      ));
    }

    cashBreakdown.annualIncomeCents += incomeCentsDelta;
    cashBreakdown.annualExpenseCents += expenseCentsDelta;
    accrualBreakdown.annualIncomeCents += incomeCentsDelta;
    accrualBreakdown.annualExpenseCents += expenseCentsDelta;

    addCategoryTotals(cashCategoryTotals, row.categoryId, incomeCentsDelta, expenseCentsDelta);
    addCategoryTotals(
      accrualCategoryTotals,
      row.categoryId,
      incomeCentsDelta,
      expenseCentsDelta
    );
  }

  function buildTotals(map: Map<string, { incomeCents: number; expenseCents: number }>): Totals {
    let incomeCents = 0;
    let expenseCents = 0;
    for (const value of map.values()) {
      incomeCents += value.incomeCents;
      expenseCents += value.expenseCents;
    }
    return {
      incomeCents,
      expenseCents,
      netCents: incomeCents + expenseCents,
    };
  }

  const cashTotals = buildTotals(cashCategoryTotals);
  const accrualTotals = buildTotals(accrualCategoryTotals);

  function buildCategoryRows(
    map: Map<string, { incomeCents: number; expenseCents: number }>
  ): CategoryRow[] {
    const rows: CategoryRow[] = [];
    for (const [categoryId, values] of map.entries()) {
      if (values.incomeCents === 0 && values.expenseCents === 0) continue;
      const category = categoryMap.get(categoryId);
      rows.push({
        categoryId,
        categoryName: category?.name ?? "Unknown category",
        incomeCents: values.incomeCents,
        expenseCents: values.expenseCents,
        netCents: values.incomeCents + values.expenseCents,
      });
    }

    rows.sort((a, b) => a.categoryName.localeCompare(b.categoryName));
    return rows;
  }

  const includeByCategory = input.view === "byCategory";

  return {
    input: {
      start: formatYmd(startDate),
      end: formatYmd(endDate),
      propertyId: input.propertyId ?? null,
      includeTransfers,
      view: includeByCategory ? "byCategory" : "summary",
      accrualMode: hasAccrualFieldData ? "real" : "fallback",
    },
    cash: {
      totals: cashTotals,
      byCategory: includeByCategory ? buildCategoryRows(cashCategoryTotals) : undefined,
      breakdown: cashBreakdown,
    },
    accrual: {
      totals: accrualTotals,
      byCategory: includeByCategory ? buildCategoryRows(accrualCategoryTotals) : undefined,
      breakdown: accrualBreakdown,
    },
    delta: {
      incomeCents: accrualTotals.incomeCents - cashTotals.incomeCents,
      expenseCents: accrualTotals.expenseCents - cashTotals.expenseCents,
      netCents: accrualTotals.netCents - cashTotals.netCents,
    },
  };
}
