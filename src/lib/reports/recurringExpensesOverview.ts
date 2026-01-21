import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type RecurringRow = {
  recurringTransactionId: string;
  propertyId: string;
  propertyLabel: string;
  categoryId: string;
  categoryName: string;
  memo: string | null;
  monthlyAmountCents: number;
  monthsInRange: string[];
  expectedTotalCents: number;
  postedTotalCents: number;
  varianceCents: number;
  missingMonths: string[];
};

export type RecurringExpensesOverviewReport = {
  input: {
    start: string;
    end: string;
    propertyId?: string;
    includeTransfers: boolean;
    includeInactive: boolean;
  };
  rows: RecurringRow[];
  totals: {
    expectedTotalCents: number;
    postedTotalCents: number;
    varianceCents: number;
  };
  otherTotals: {
    otherTransactionalExpenseCents: number;
    annualExpenseCents: number;
    allExpenseCents: number;
  };
};

export async function getRecurringExpensesOverviewReport(input: {
  start: string;
  end: string;
  propertyId?: string;
  includeTransfers?: boolean;
  includeInactive?: boolean;
}): Promise<RecurringExpensesOverviewReport> {
  let startDate = parseYmd(input.start);
  let endDate = parseYmd(input.end);
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const includeTransfers = Boolean(input.includeTransfers);
  const includeInactive = Boolean(input.includeInactive);
  const propertyId = input.propertyId && input.propertyId !== "all" ? input.propertyId : undefined;
  const monthsInRange = monthRangeInclusive(startDate, endDate);
  const endDateExclusive = endExclusive(endDate);

  const recurring = await prisma.recurringTransaction.findMany({
    where: {
      propertyId: propertyId || undefined,
      ...(includeInactive ? {} : { isActive: true }),
      category: { type: "expense" },
    },
    select: {
      id: true,
      propertyId: true,
      categoryId: true,
      amountCents: true,
      memo: true,
      dayOfMonth: true,
      startMonth: true,
      endMonth: true,
      isActive: true,
      category: { select: { id: true, name: true, type: true } },
      property: {
        select: {
          id: true,
          nickname: true,
          street: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  const recurringIds = recurring.map((r) => r.id);

  const postings =
    recurringIds.length > 0 && monthsInRange.length > 0
      ? await prisma.recurringPosting.findMany({
          where: {
            recurringTransactionId: { in: recurringIds },
            month: { in: monthsInRange },
          },
          select: {
            recurringTransactionId: true,
            month: true,
            ledgerTransactionId: true,
          },
        })
      : [];

  const ledgerTransactionIds = postings.map((p) => p.ledgerTransactionId);

  const ledgerTransactions =
    ledgerTransactionIds.length > 0
      ? await prisma.transaction.findMany({
          where: {
            id: { in: ledgerTransactionIds },
            propertyId: propertyId || undefined,
            deletedAt: null,
            ...(includeTransfers ? {} : { category: { type: { not: "transfer" } } }),
          },
          select: {
            id: true,
            amount: true,
            category: { select: { type: true } },
          },
        })
      : [];

  const ledgerMap = new Map(
    ledgerTransactions.map((tx) => [
      tx.id,
      {
        amountCents: Math.round(Number(tx.amount ?? 0) * 100),
        categoryType: tx.category.type,
      },
    ])
  );

  const rows: RecurringRow[] = [];

  for (const r of recurring) {
    if (!includeInactive && !r.isActive) continue;

    const applicableMonths = monthsInRange.filter((m) => {
      if (ymCompare(m, r.startMonth) < 0) return false;
      if (r.endMonth && ymCompare(m, r.endMonth) > 0) return false;
      return true;
    });

    if (applicableMonths.length === 0) continue;

    // Normalize expense direction in case imported data flipped the sign.
    const monthlyAmountCents =
      r.category.type === "expense" && r.amountCents > 0
        ? -Math.abs(r.amountCents)
        : r.amountCents;

    const postedForRecurring = postings.filter((p) => p.recurringTransactionId === r.id);
    let postedTotalCents = 0;
    const postedMonths = new Set<string>();

    for (const p of postedForRecurring) {
      const ledger = ledgerMap.get(p.ledgerTransactionId);
      if (!ledger) continue;
      postedMonths.add(p.month);
      postedTotalCents += ledger.amountCents;
    }

    const missingMonths = applicableMonths.filter((m) => !postedMonths.has(m));
    const expectedTotalCents = monthlyAmountCents * applicableMonths.length;
    const varianceCents = postedTotalCents - expectedTotalCents;

    rows.push({
      recurringTransactionId: r.id,
      propertyId: r.propertyId,
      propertyLabel: propertyLabel(r.property),
      categoryId: r.categoryId,
      categoryName: r.category.name,
      memo: r.memo ?? null,
      monthlyAmountCents,
      monthsInRange: applicableMonths,
      expectedTotalCents,
      postedTotalCents,
      varianceCents,
      missingMonths,
    });
  }

  rows.sort((a, b) => {
    if (a.propertyLabel !== b.propertyLabel) return a.propertyLabel.localeCompare(b.propertyLabel);
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
    const memoA = a.memo ?? "";
    const memoB = b.memo ?? "";
    return memoA.localeCompare(memoB);
  });

  const totals = rows.reduce(
    (acc, cur) => {
      acc.expectedTotalCents += cur.expectedTotalCents;
      acc.postedTotalCents += cur.postedTotalCents;
      acc.varianceCents += cur.varianceCents;
      return acc;
    },
    { expectedTotalCents: 0, postedTotalCents: 0, varianceCents: 0 }
  );

  const recurringLedgerIdsInRange = new Set(postings.map((p) => p.ledgerTransactionId));

  const allowedExpenseTypes: CategoryType[] = includeTransfers ? ["expense", "transfer"] : ["expense"];

  const otherTransactions = await prisma.transaction.findMany({
    where: {
      propertyId: propertyId || undefined,
      category: { type: { in: allowedExpenseTypes } },
      deletedAt: null,
      id: recurringLedgerIdsInRange.size ? { notIn: Array.from(recurringLedgerIdsInRange) } : undefined,
      date: { gte: startDate, lt: endDateExclusive },
    },
    select: { amount: true, category: { select: { type: true } } },
  });

  let otherTransactionalExpenseCents = 0;
  for (const tx of otherTransactions) {
    const rawCents = Math.round(Number(tx.amount ?? 0) * 100);
    const normalized =
      tx.category.type === "expense" && rawCents > 0 ? -Math.abs(rawCents) : rawCents;
    otherTransactionalExpenseCents += normalized;
  }

  const startYear = startDate.getUTCFullYear();
  const endYear = endDate.getUTCFullYear();

  const annualRows = await prisma.annualCategoryAmount.findMany({
    where: {
      propertyId: propertyId || undefined,
      year: { gte: startYear, lte: endYear },
      category: { type: "expense" },
    },
    select: {
      amount: true,
      year: true,
    },
  });

  let annualExpenseCents = 0;
  for (const row of annualRows) {
    const prorated = prorateAnnualForRange(
      row.year,
      Math.round(Number(row.amount ?? 0) * 100),
      startDate,
      endDate
    );
    // Annual expense categories include negatives (expense) and positives (refunds).
    // Include both so refunds reduce total expenses.
    annualExpenseCents += prorated;
  }

  const allExpenseCents = totals.postedTotalCents + otherTransactionalExpenseCents + annualExpenseCents;

  return {
    input: {
      start: input.start,
      end: input.end,
      propertyId,
      includeTransfers,
      includeInactive,
    },
    rows,
    totals,
    otherTotals: {
      otherTransactionalExpenseCents,
      annualExpenseCents,
      allExpenseCents,
    },
  };
}

export function parseYmd(s: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!match) throw new Error(`Invalid date: ${s}`);
  const [, y, m, d] = match;
  return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
}

export function endExclusive(endInclusive: Date): Date {
  return new Date(Date.UTC(endInclusive.getUTCFullYear(), endInclusive.getUTCMonth(), endInclusive.getUTCDate() + 1));
}

export function toYm(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function addMonths(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function monthRangeInclusive(start: Date, end: Date): string[] {
  const startYm = toYm(start);
  const endYm = toYm(end);
  if (ymCompare(endYm, startYm) < 0) return [];

  const out: string[] = [];
  let cur = startYm;
  while (ymCompare(cur, endYm) <= 0) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function ymCompare(a: string, b: string): number {
  if (a === b) return 0;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay === by) return am - bm;
  return ay - by;
}

export function daysInYear(year: number): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / 86_400_000);
}

export function overlapDaysInclusive(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;

  const startMs = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const endMs = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());

  return Math.floor((endMs - startMs) / 86_400_000) + 1;
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
  return Math.round((amountCents * overlap) / daysInYear(year));
}
