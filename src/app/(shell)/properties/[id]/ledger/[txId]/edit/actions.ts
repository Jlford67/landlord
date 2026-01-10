"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function toUtcDateFromYmd(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
}

export async function updateTransaction(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const txId = String(formData.get("txId") ?? "");
  const dateYmd = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const month = String(formData.get("month") ?? "");
  const payee = String(formData.get("payee") ?? "").trim() || null;
  const memo = String(formData.get("memo") ?? "").trim() || null;

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountNum = Number(amountRaw);

  if (!propertyId || !txId) throw new Error("Missing transaction identifiers");
  if (!categoryId) throw new Error("Missing category");
  if (!dateYmd) throw new Error("Missing date");
  if (!Number.isFinite(amountNum)) throw new Error("Amount must be a number");

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { type: true },
  });

  if (!category) throw new Error("Category not found");

  const abs = Math.abs(amountNum);
  let amount = amountNum;
  if (category.type === "income") amount = abs;
  if (category.type === "expense") amount = -abs;

  await prisma.transaction.updateMany({
    where: { id: txId, propertyId },
    data: {
      date: toUtcDateFromYmd(dateYmd),
      categoryId,
      amount,
      payee,
      memo,
      statementMonth: month || null,
      source: "manual",
    },
  });

  const qs = month && /^\d{4}-\d{2}$/.test(month) ? `?month=${encodeURIComponent(month)}` : "";
  redirect(`/properties/${propertyId}/ledger${qs}`);
}
