import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toNumber(v: FormDataEntryValue | null) {
  if (v == null) return NaN;
  const s = String(v).trim();
  return Number(s);
}

function toStringTrim(v: FormDataEntryValue | null) {
  if (v == null) return "";
  return String(v).trim();
}

function isIsoDateOnly(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function safeReturnTo(returnTo: string | undefined, propertyId: string) {
  const trimmed = (returnTo ?? "").trim();
  return trimmed.startsWith("/") ? trimmed : `/properties/${propertyId}/ledger`;
}

function redirectWithMsg(
  req: Request,
  path: string,
  msg: string,
  extra?: { month?: string }
) {
  const url = new URL(path, req.url);
  url.searchParams.set("msg", msg);
  if (extra?.month && /^\d{4}-\d{2}$/.test(extra.month)) {
    url.searchParams.set("month", extra.month);
  }
  return NextResponse.redirect(url);
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  await requireUser();

  const p = await Promise.resolve(ctx.params as any);
  const propertyId = String(p.id);

  const form = await req.formData();

  const returnTo = safeReturnTo(toStringTrim(form.get("returnTo")), propertyId);
  const month = toStringTrim(form.get("month")); // current ledger month (may differ from txn date)
  const dateStr = toStringTrim(form.get("date"));
  const categoryId = toStringTrim(form.get("categoryId"));
  const payee = toStringTrim(form.get("payee")) || null;
  const memo = toStringTrim(form.get("memo")) || null;

  const amountRaw = toNumber(form.get("amount"));

  // If invalid, redirect back to the current month (best effort) with an error msg
  if (!isIsoDateOnly(dateStr)) {
    return redirectWithMsg(req, returnTo, "invalid_date", { month });
  }

  if (!categoryId) {
    return redirectWithMsg(req, returnTo, "missing_category", { month });
  }

  if (!Number.isFinite(amountRaw) || amountRaw === 0) {
    return redirectWithMsg(req, returnTo, "invalid_amount", { month });
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true, active: true },
  });

  if (!category || !category.active) {
    return redirectWithMsg(req, returnTo, "invalid_category", { month });
  }

  // Normalize amount based on category type
  let amount = amountRaw;

  if (category.type === "income") {
    amount = Math.abs(amountRaw);
  } else if (category.type === "expense") {
    amount = -Math.abs(amountRaw);
  } else {
    // transfer: leave sign as entered (you can change this rule later)
    amount = amountRaw;
  }

  // Date-only input -> store as UTC midnight
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  await prisma.transaction.create({
    data: {
      propertyId,
      date,
      categoryId: category.id,
      amount,
      payee,
      memo,
      source: "manual", // matches your enum TransactionSource
    },
  });

  // Redirect to the month of the transaction date so the user always sees what they just added.
  const monthFromDate = dateStr.slice(0, 7);
  const redirectMonth =
    monthFromDate && /^\d{4}-\d{2}$/.test(monthFromDate) ? monthFromDate : "";

  return redirectWithMsg(req, returnTo, "created", { month: redirectMonth || month });
}
