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
  return new Date(Date.UTC(y, m - 1, clampedDay));
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
