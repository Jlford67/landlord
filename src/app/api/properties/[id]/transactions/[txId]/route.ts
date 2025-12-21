import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toNumber(v: FormDataEntryValue | null) {
  if (v == null) return NaN;
  const s = String(v).trim();
  const n = Number(s);
  return n;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; txId: string }> | { id: string; txId: string } }
) {
  await requireUser();

  const p = await Promise.resolve(ctx.params as any);
  const propertyId = p.id as string;
  const txId = p.txId as string;

  const form = await req.formData();

  const dateStr = String(form.get("date") ?? "").trim();
  const categoryId = String(form.get("categoryId") ?? "").trim();
  const month = String(form.get("month") ?? "").trim();
  const payee = String(form.get("payee") ?? "").trim() || null;
  const memo = String(form.get("memo") ?? "").trim() || null;

  const rawAmount = toNumber(form.get("amount"));
  if (!dateStr || !categoryId || Number.isNaN(rawAmount)) {
    return NextResponse.redirect(new URL(`/properties/${propertyId}/ledger?msg=invalid`, req.url));
  }

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!category) {
    return NextResponse.redirect(new URL(`/properties/${propertyId}/ledger?msg=invalid`, req.url));
  }

  // Normalize amount sign based on category type.
  const base = Math.abs(rawAmount);

  let amount = base;
  if (category.type === "expense") amount = -base;

  await prisma.transaction.updateMany({
    where: { id: txId, propertyId },
    data: {
      date: new Date(dateStr + "T00:00:00.000Z"),
      categoryId,
      amount,
      payee,
      memo,
      statementMonth: month || null,
      source: "manual",
    },
  });

  const qs = month && /^\d{4}-\d{2}$/.test(month) ? `&month=${encodeURIComponent(month)}` : "";
  return NextResponse.redirect(new URL(`/properties/${propertyId}/ledger?msg=updated${qs}`, req.url));
}
