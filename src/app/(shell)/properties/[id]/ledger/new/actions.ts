"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function toUtcDateFromYmd(ymd: string) {
  // ymd = "YYYY-MM-DD"
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1, 0, 0, 0));
}

export async function createTransaction(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const returnTo = String(formData.get("returnTo") ?? "");
  const dateYmd = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("categoryId") ?? "");
  const memo = String(formData.get("memo") ?? "").trim() || null;
  const payee = String(formData.get("payee") ?? "").trim() || null;

  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amountNum = Number(amountRaw);

  if (!propertyId) throw new Error("Missing propertyId");
  if (!categoryId) throw new Error("Missing categoryId");
  if (!dateYmd) throw new Error("Missing date");
  if (!Number.isFinite(amountNum)) throw new Error("Amount must be a number");

  const category = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { type: true },
  });

  if (!category) throw new Error("Category not found");

  const abs = Math.abs(amountNum);
  let amount = amountNum;

  // Enforce app convention: income positive, expense negative.
  if (category.type === "income") amount = abs;
  if (category.type === "expense") amount = -abs;
  // transfer: leave as entered (amountNum)

  await prisma.transaction.create({
    data: {
      propertyId,
      categoryId,
      date: toUtcDateFromYmd(dateYmd),
      amount,
      memo,
      payee,
      source: "manual",
    },
  });

  redirect(returnTo || `/properties/${propertyId}/ledger`);
}
