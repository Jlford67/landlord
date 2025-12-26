import { prisma } from "./db";

export function monthCompare(a: string, b: string) {
  if (a === b) return 0;
  const [ay, am] = a.split("-").map(Number);
  const [by, bm] = b.split("-").map(Number);
  if (ay === by) return am - bm;
  return ay - by;
}

export function isMonthInRange(month: string, startMonth: string, endMonth?: string | null) {
  if (monthCompare(month, startMonth) < 0) return false;
  if (endMonth && monthCompare(month, endMonth) > 0) return false;
  return true;
}

export function dueDateForMonth(month: string, dayOfMonth: number) {
  const [y, m] = month.split("-").map(Number);
  const clampedDay = Math.min(Math.max(dayOfMonth, 1), 28);

  // Use UTC boundaries so the month math matches regardless of server timezone.
  // Noon avoids DST edge cases while keeping the same calendar day in any locale.
  return new Date(Date.UTC(y, m - 1, clampedDay, 12, 0, 0, 0));
}

export function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const idx = y * 12 + (m - 1) + delta;
  const ny = Math.floor(idx / 12);
  const nm = (idx % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

export function monthsBetweenInclusive(startMonth: string, endMonth: string) {
  if (monthCompare(endMonth, startMonth) < 0) return [];
  const out: string[] = [];
  let cur = startMonth;
  while (monthCompare(cur, endMonth) <= 0) {
    out.push(cur);
    cur = addMonths(cur, 1);
  }
  return out;
}

export function currentYmUtc() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export async function getScheduledRecurringForMonth(propertyId: string, month: string) {
  const recurrences = await prisma.recurringTransaction.findMany({
    where: { propertyId, isActive: true },
    include: {
      category: true,
      postings: {
        where: { month },
        select: { id: true },
      },
    },
    orderBy: [
      { dayOfMonth: "asc" },
      { createdAt: "asc" },
    ],
  });

  return recurrences
    .filter((r) => isMonthInRange(month, r.startMonth, r.endMonth))
    .map((r) => ({
      ...r,
      alreadyPosted: r.postings.length > 0,
    }));
}

export async function postRecurringUpToMonth(propertyId: string, upToMonth?: string) {
  const targetMonth = upToMonth ?? currentYmUtc();

  // Pull all recurring rules for the property that could apply
  const rules = await prisma.recurringTransaction.findMany({
    where: {
      propertyId,
      isActive: true,
      startMonth: { lte: targetMonth },
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
    },
  });

  let createdCount = 0;

  for (const r of rules) {
    const effectiveEnd = r.endMonth && monthCompare(r.endMonth, targetMonth) < 0 ? r.endMonth : targetMonth;

    const months = monthsBetweenInclusive(r.startMonth, effectiveEnd);
    if (months.length === 0) continue;

    // Find which months are already posted
    const existing = await prisma.recurringPosting.findMany({
      where: {
        recurringTransactionId: r.id,
        month: { in: months },
      },
      select: { month: true },
    });

    const already = new Set(existing.map((x) => x.month));
    const toCreate = months.filter((m) => !already.has(m));
    if (toCreate.length === 0) continue;

    for (const month of toCreate) {
      // Atomic create of Transaction + Posting, with a uniqueness guard
      await prisma.$transaction(async (tx) => {
        // guard against double-click / concurrent calls
        const exists = await tx.recurringPosting.findUnique({
          where: { recurringTransactionId_month: { recurringTransactionId: r.id, month } },
          select: { id: true },
        });
        if (exists) return;

        // Your ledger uses Transaction.amount FLOAT. RecurringTransaction stores amountCents.
        // Expense should be negative.
        const amount = -(Math.abs(r.amountCents) / 100);

        const ledger = await tx.transaction.create({
          data: {
            propertyId: r.propertyId,
            categoryId: r.categoryId,
            date: dueDateForMonth(month, r.dayOfMonth),
            amount,
            memo: r.memo ?? "Recurring",
            payee: null,
            source: "manual",
            statementMonth: month, // optional helper; keep if you like grouping by month
            isOwnerPayout: false,
          },
          select: { id: true },
        });

        await tx.recurringPosting.create({
          data: {
            recurringTransactionId: r.id,
            month,
            ledgerTransactionId: ledger.id,
          },
        });

        createdCount += 1;
      });
    }
  }

  return { createdCount, upToMonth: targetMonth };
}
