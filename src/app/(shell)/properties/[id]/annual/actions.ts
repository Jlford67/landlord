"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";

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
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const propertyOwnershipIdRaw = String(formData.get("propertyOwnershipId") ?? "").trim();
  const propertyOwnershipId = propertyOwnershipIdRaw ? propertyOwnershipIdRaw : null;
  const amountAbs = Math.abs(toFloat(formData.get("amountAbs")));
  const note = (formData.get("note") ?? "").toString().trim() || null;

  if (!propertyId || !categoryId || !year) throw new Error("Missing required fields");

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!cat) throw new Error("Category not found");
  if (cat.type === "transfer") throw new Error("Transfer categories are not allowed for annual data");

  if (propertyOwnershipId) {
    const ownership = await prisma.propertyOwnership.findFirst({
      where: { id: propertyOwnershipId, propertyId },
      select: { id: true },
    });
    if (!ownership) throw new Error("Ownership not found");
  }

  const signedAmount = cat.type === "expense" ? -amountAbs : amountAbs;

  await prisma.annualCategoryAmount.create({
    data: { propertyId, year, categoryId, amount: signedAmount, note, propertyOwnershipId },
  });

  revalidatePath(`/properties/${propertyId}/annual`);
  redirect(`/properties/${propertyId}/annual?year=${year}`);
}

export async function upsertAnnualEntry(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const propertyOwnershipIdRaw = String(formData.get("propertyOwnershipId") ?? "").trim();
  const propertyOwnershipId = propertyOwnershipIdRaw ? propertyOwnershipIdRaw : null;
  const amountAbs = Math.abs(toFloat(formData.get("amountAbs")));
  const note = (formData.get("note") ?? "").toString().trim() || null;

  if (!propertyId || !categoryId || !year) throw new Error("Missing required fields");

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!cat) throw new Error("Category not found");
  if (cat.type === "transfer") throw new Error("Transfer categories are not allowed for annual data");

  if (propertyOwnershipId) {
    const ownership = await prisma.propertyOwnership.findFirst({
      where: { id: propertyOwnershipId, propertyId },
      select: { id: true },
    });
    if (!ownership) throw new Error("Ownership not found");
  }

  const signedAmount = cat.type === "expense" ? -amountAbs : amountAbs;

  if (entryId) {
    const existing = await prisma.annualCategoryAmount.findFirst({
      where: { id: entryId, propertyId },
      select: { id: true },
    });

    if (!existing) throw new Error("Annual entry not found");

    await prisma.annualCategoryAmount.update({
      where: { id: existing.id },
      data: { amount: signedAmount, note, propertyOwnershipId, year, categoryId },
    });
  } else {
    await prisma.annualCategoryAmount.create({
      data: { propertyId, year, categoryId, amount: signedAmount, note, propertyOwnershipId },
    });
  }

  revalidatePath(`/properties/${propertyId}/ledger`);
  redirect(`/properties/${propertyId}/ledger?view=annual&year=${year}`);
}

export async function deleteAnnualLine(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const id = String(formData.get("id") ?? "");

  if (!id || !propertyId || !year) throw new Error("Missing required fields");

  await prisma.annualCategoryAmount.delete({ where: { id } });

  revalidatePath(`/properties/${propertyId}/annual`);
  redirect(`/properties/${propertyId}/annual?year=${year}`);
}
