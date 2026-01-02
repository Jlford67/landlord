"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function toInt(v: FormDataEntryValue | null): number {
  const n = Number(v ?? "");
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  return Math.trunc(n);
}

function toFloat(v: FormDataEntryValue | null): number {
  const n = Number(v ?? "");
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  return n;
}

// Save one annual line (property+year+category). User enters a POSITIVE amount.
// We store signed like Transaction: +income, -expense based on Category.type.
export async function saveAnnualLine(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const amountAbs = Math.abs(toFloat(formData.get("amountAbs")));
  const note = (formData.get("note") ?? "").toString().trim() || null;

  if (!propertyId || !categoryId || !year) throw new Error("Missing required fields");

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!cat) throw new Error("Category not found");
  if (cat.type === "transfer") throw new Error("Transfer categories are not allowed for annual data");

  const signedAmount = cat.type === "expense" ? -amountAbs : amountAbs;

  await prisma.annualCategoryAmount.upsert({
    where: { propertyId_year_categoryId: { propertyId, year, categoryId } },
    update: { amount: signedAmount, note },
    create: { propertyId, year, categoryId, amount: signedAmount, note },
  });

  revalidatePath(`/properties/${propertyId}/annual`);
  redirect(`/properties/${propertyId}/annual?year=${year}`);
}

export async function deleteAnnualLine(formData: FormData) {
  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const id = String(formData.get("id") ?? "");

  if (!id || !propertyId || !year) throw new Error("Missing required fields");

  await prisma.annualCategoryAmount.delete({ where: { id } });

  revalidatePath(`/properties/${propertyId}/annual`);
  redirect(`/properties/${propertyId}/annual?year=${year}`);
}
