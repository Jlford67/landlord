"use server";

import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dueDateForMonth, getScheduledRecurringForMonth } from "@/lib/recurring";
import { createRecurringSchema, updateRecurringSchema } from "@/lib/validation/recurring";

function ym(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function signedAmount(amountCents: number, categoryType: string) {
  const base = amountCents / 100;
  if (categoryType === "income") return Math.abs(base);
  if (categoryType === "expense") return -Math.abs(base);
  return base;
}

function redirectToLedger(propertyId: string, month: string, msg?: string, extra?: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  qs.set("month", month);
  if (msg) qs.set("msg", msg);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) qs.set(key, value);
    }
  }
  redirect(`/properties/${propertyId}/ledger?${qs.toString()}`);
}

type RecurringForm = {
  propertyId: string;
  categoryId: string;
  amount: string | number;
  memo?: string | null;
  dayOfMonth: string | number;
  startMonth: string;
  endMonth?: string | null;
  isActive?: string;
  currentMonth?: string;
};

export async function createRecurringTransaction(formData: FormData) {
  await requireUser();

  try {
    const propertyId = String(formData.get("propertyId") || "").trim();
    const categoryId = String(formData.get("categoryId") || "").trim();

    const amount = String(formData.get("amount") ?? "0").trim();

    const memoRaw = formData.get("memo");
    const memo = typeof memoRaw === "string" && memoRaw.trim() !== "" ? memoRaw.trim() : undefined;

    const dayOfMonth = String(formData.get("dayOfMonth") ?? "1").trim();
    const startMonth = String(formData.get("startMonth") || "").trim();

    const endMonthRaw = formData.get("endMonth");
    const endMonth = typeof endMonthRaw === "string" && endMonthRaw.trim() !== "" ? endMonthRaw.trim() : undefined;

    const isActiveRaw = formData.get("isActive");
    const isActive = typeof isActiveRaw === "string" ? isActiveRaw : undefined;

    const currentMonthRaw = formData.get("currentMonth");
    const currentMonth = typeof currentMonthRaw === "string" && currentMonthRaw.trim() !== "" ? currentMonthRaw.trim() : undefined;

    const raw: RecurringForm = {
      propertyId,
      categoryId,
      amount,
      memo,
      dayOfMonth,
      startMonth,
      endMonth,
      isActive,
      currentMonth,
    };

    if (!raw.categoryId) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_category" });
    }

    if (raw.amount === "" || raw.amount === null) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_amount" });
    }

    if (!raw.startMonth) {
      const viewMonth = raw.currentMonth || ym(new Date());
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_startMonth" });
    }

    const parsed = createRecurringSchema.safeParse(raw);
    if (!parsed.success) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      const detail = parsed.error.issues.some((i) => i.path.includes("amount")) ? "invalid_amount" : "validation_error";
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail });
    }

    const data = parsed.data;

    await prisma.recurringTransaction.create({
      data: {
        propertyId: data.propertyId,
        categoryId: data.categoryId,
        amountCents: data.amount,
        memo: data.memo,
        dayOfMonth: data.dayOfMonth,
        startMonth: data.startMonth,
        endMonth: data.endMonth ?? undefined,
        isActive: data.isActive,
      },
    });

    const viewMonth = raw.currentMonth || data.startMonth;
    return redirectToLedger(data.propertyId, viewMonth, "recurring_created");
  } catch (error: any) {
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    const propertyId = String(formData.get("propertyId") || "").trim();
    const currentMonth = String(formData.get("currentMonth") || formData.get("startMonth") || ym(new Date())).trim();

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(propertyId, currentMonth, "recurring_error", { detail: "missing_table" });
    }
    return redirectToLedger(propertyId, currentMonth || ym(new Date()), "recurring_error", { detail: "prisma_error" });
  }
}

export async function updateRecurringTransaction(formData: FormData) {
  await requireUser();

  const raw: RecurringForm & { id: string } = {
    id: String(formData.get("id") || ""),
    propertyId: String(formData.get("propertyId") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    amount: formData.get("amount") || "0",
    memo: (formData.get("memo") as string | null) ?? undefined,
    dayOfMonth: formData.get("dayOfMonth") || "1",
    startMonth: String(formData.get("startMonth") || ""),
    endMonth: (formData.get("endMonth") as string | null) ?? undefined,
    isActive: (formData.get("isActive") as string | null) ?? undefined,
    currentMonth: (formData.get("currentMonth") as string | null) ?? undefined,
  };

  const parsed = updateRecurringSchema.safeParse(raw);
  if (!parsed.success) {
    const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
    return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "validation_error" });
  }

  const data = parsed.data;

  await prisma.recurringTransaction.update({
    where: { id: data.id, propertyId: data.propertyId },
    data: {
      categoryId: data.categoryId,
      amountCents: data.amount,
      memo: data.memo,
      dayOfMonth: data.dayOfMonth,
      startMonth: data.startMonth,
      endMonth: data.endMonth || undefined,
      isActive: data.isActive,
    },
  });

  const viewMonth = raw.currentMonth || data.startMonth;
  redirectToLedger(data.propertyId, viewMonth, "recurring_updated");
}

export async function toggleRecurringTransaction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));
  const isActive = String(formData.get("isActive") || "") === "true";

  await prisma.recurringTransaction.update({
    where: { id, propertyId },
    data: { isActive },
  });

  redirectToLedger(propertyId, month, "recurring_toggled");
}

export async function deleteRecurringTransaction(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));

  await prisma.recurringTransaction.delete({
    where: { id, propertyId },
  });

  redirectToLedger(propertyId, month, "recurring_deleted");
}

async function postRecurringForMonthInternal(propertyId: string, month: string) {
  const scheduled = await getScheduledRecurringForMonth(propertyId, month);
  const toPost = scheduled.filter((r) => !r.alreadyPosted && r.category);

  if (toPost.length === 0) return 0;

  let postedCount = 0;

  await prisma.$transaction(async (tx) => {
    for (const rec of toPost) {
      const existing = await tx.recurringPosting.findFirst({
        where: { recurringTransactionId: rec.id, month },
        select: { id: true },
      });
      if (existing) continue;

      const txn = await tx.transaction.create({
        data: {
          propertyId,
          date: dueDateForMonth(month, rec.dayOfMonth),
          categoryId: rec.categoryId,
          amount: signedAmount(rec.amountCents, rec.category.type),
          memo: rec.memo ? `Recurring: ${rec.memo}` : `Recurring: ${rec.category.name}`,
          source: "manual",
        },
      });

      await tx.recurringPosting.create({
        data: {
          recurringTransactionId: rec.id,
          month,
          ledgerTransactionId: txn.id,
        },
      });

      postedCount += 1;
    }
  });

  return postedCount;
}

export async function postRecurringForMonth(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));

  try {
    const postedCount = await postRecurringForMonthInternal(propertyId, month);

    if (postedCount === 0) {
      return redirectToLedger(propertyId, month, "recurring-none", {
        detail: "Nothing new to post for this month.",
      });
    }

    return redirectToLedger(propertyId, month, "recurring-posted", {
      posted: String(postedCount),
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(propertyId, month, "recurring_error", { detail: "missing_table" });
    }
    return redirectToLedger(propertyId, month, "recurring_error", { detail: "prisma_error_post" });
  }
}

function addMonths(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1 + delta, 1, 0, 0, 0));
  const yy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${yy}-${mm}`;
}

export async function postRecurringCatchUp(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") || "");
  const throughMonth = String(formData.get("throughMonth") || ym(new Date()));

  if (!propertyId) throw new Error("Missing propertyId");

  const first = await prisma.recurringTransaction.findFirst({
    where: { propertyId, isActive: true },
    orderBy: [{ startMonth: "asc" }],
    select: { startMonth: true },
  });

  if (!first?.startMonth) {
    return redirectToLedger(propertyId, throughMonth, "recurring-none", { detail: "No active recurring items." });
  }

  let m = first.startMonth;
  let totalPosted = 0;

  while (m <= throughMonth) {
    totalPosted += await postRecurringForMonthInternal(propertyId, m);
    m = addMonths(m, 1);
  }

  if (totalPosted === 0) {
    return redirectToLedger(propertyId, throughMonth, "recurring-none", { detail: "Nothing new to post." });
  }

  return redirectToLedger(propertyId, throughMonth, "recurring-posted", { posted: String(totalPosted) });
}

