"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

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
type AnnualLineResult = { error?: string };

function asActionError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function signedAmountForType(type: "income" | "expense", amountRaw: number) {
  if (type === "expense") {
    if (amountRaw < 0) return Math.abs(amountRaw);
    return -Math.abs(amountRaw);
  }
  return amountRaw;
}

export async function saveAnnualLine(formData: FormData): Promise<AnnualLineResult> {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const propertyOwnershipIdRaw = String(formData.get("propertyOwnershipId") ?? "").trim();
  const propertyOwnershipId = propertyOwnershipIdRaw ? propertyOwnershipIdRaw : null;
  const amountRaw = toFloat(formData.get("amountAbs"));
  const note = (formData.get("note") ?? "").toString().trim() || null;

  if (!propertyId || !categoryId || !year) {
    return { error: "Missing required fields." };
  }

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!cat) return { error: "Category not found." };
  if (cat.type === "transfer") {
    return { error: "Transfer categories are not allowed for annual data." };
  }

  if (propertyOwnershipId) {
    const ownership = await prisma.propertyOwnership.findFirst({
      where: { id: propertyOwnershipId, propertyId },
      select: { id: true },
    });
    if (!ownership) return { error: "Ownership not found." };
  }

  const signedAmount = cat.type === "expense" ? -amountAbs : amountAbs;

  await prisma.annualCategoryAmount.create({
    data: { propertyId, year, categoryId, amount: signedAmount, note, propertyOwnershipId },
  });

  if (existing) {
    return { error: "That category and ownership already has a line for this year." };
  }

  const signedAmount = signedAmountForType(cat.type, amountRaw);

  try {
    await prisma.annualCategoryAmount.create({
      data: { propertyId, year, categoryId, amount: signedAmount, note, propertyOwnershipId },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { error: "That category and ownership already has a line for this year." };
    }
    return { error: asActionError(error, "Unable to save this line. Please try again.") };
  }

  revalidatePath(`/properties/${propertyId}/annual`);
  return {};
}

export async function upsertAnnualEntry(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const propertyOwnershipIdRaw = String(formData.get("propertyOwnershipId") ?? "").trim();
  const propertyOwnershipId = propertyOwnershipIdRaw ? propertyOwnershipIdRaw : null;
  const amountRaw = toFloat(formData.get("amountAbs"));
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

  const signedAmount = signedAmountForType(cat.type, amountRaw);

<<<<<<< HEAD
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
=======
  const [existing, matching] = await Promise.all([
    entryId
      ? prisma.annualCategoryAmount.findFirst({
          where: { id: entryId, propertyId },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.annualCategoryAmount.findFirst({
      where: { propertyId, year, categoryId, propertyOwnershipId },
      select: { id: true },
    }),
  ]);

  if (matching && matching.id !== entryId) {
    await prisma.annualCategoryAmount.update({
      where: { id: matching.id },
      data: { amount: signedAmount, note, propertyOwnershipId },
    });
  } else if (entryId) {
    await prisma.annualCategoryAmount.update({
      where: { id: entryId },
      data: { categoryId, amount: signedAmount, note, propertyOwnershipId },
    });
  } else {
    await prisma.annualCategoryAmount.create({
      data: { propertyId, year, categoryId, amount: signedAmount, note, propertyOwnershipId },
    });
  }

  if (existing && matching && existing.id !== matching.id) {
    await prisma.annualCategoryAmount.delete({ where: { id: existing.id } });
>>>>>>> codex/add-edit-functionality-to-annual-amounts
  }

  revalidatePath(`/properties/${propertyId}/ledger`);
  redirect(`/properties/${propertyId}/ledger?view=annual&year=${year}`);
}

export async function updateAnnualLine(formData: FormData): Promise<AnnualLineResult> {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const entryId = String(formData.get("entryId") ?? "");
  const year = toInt(formData.get("year"));
  const categoryId = String(formData.get("categoryId") ?? "");
  const propertyOwnershipIdRaw = String(formData.get("propertyOwnershipId") ?? "").trim();
  const propertyOwnershipId = propertyOwnershipIdRaw ? propertyOwnershipIdRaw : null;
  const amountRaw = toFloat(formData.get("amountAbs"));
  const note = (formData.get("note") ?? "").toString().trim() || null;

  if (!propertyId || !entryId || !categoryId || !year) {
    return { error: "Missing required fields." };
  }

  const entry = await prisma.annualCategoryAmount.findFirst({
    where: { id: entryId, propertyId, year },
    select: { id: true },
  });
  if (!entry) return { error: "Annual line not found." };

  const cat = await prisma.category.findUnique({
    where: { id: categoryId },
    select: { id: true, type: true },
  });
  if (!cat) return { error: "Category not found." };
  if (cat.type === "transfer") {
    return { error: "Transfer categories are not allowed for annual data." };
  }

  if (propertyOwnershipId) {
    const ownership = await prisma.propertyOwnership.findFirst({
      where: { id: propertyOwnershipId, propertyId },
      select: { id: true },
    });
    if (!ownership) return { error: "Ownership not found." };
  }

  const conflicting = await prisma.annualCategoryAmount.findFirst({
    where: {
      propertyId,
      year,
      categoryId,
      propertyOwnershipId,
      NOT: { id: entryId },
    },
    select: { id: true },
  });

  if (conflicting) {
    return { error: "That category and ownership already has a line for this year." };
  }

  const signedAmount = signedAmountForType(cat.type, amountRaw);

  try {
    await prisma.annualCategoryAmount.update({
      where: { id: entryId },
      data: { categoryId, amount: signedAmount, note, propertyOwnershipId },
    });
  } catch (error) {
    return { error: asActionError(error, "Unable to update this line. Please try again.") };
  }

  revalidatePath(`/properties/${propertyId}/annual`);
  return {};
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
