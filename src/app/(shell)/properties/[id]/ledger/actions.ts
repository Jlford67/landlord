"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function toInt(v: FormDataEntryValue | null): number {
  const n = Number(v ?? "");
  if (!Number.isFinite(n)) throw new Error("Invalid number");
  return Math.trunc(n);
}

export async function deleteAnnualEntry(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("propertyId") ?? "");
  const year = toInt(formData.get("year"));
  const month = String(formData.get("month") ?? "");
  const id = String(formData.get("id") ?? "");

  if (!id || !propertyId || !year) throw new Error("Missing required fields");

  const existing = await prisma.annualCategoryAmount.findFirst({
    where: { id, propertyId },
    select: { id: true },
  });

  if (!existing) throw new Error("Annual entry not found");

  await prisma.annualCategoryAmount.delete({ where: { id: existing.id } });

  revalidatePath(`/properties/${propertyId}/ledger`);
  redirect(`/properties/${propertyId}/ledger?view=annual&year=${year}&month=${month}`);
}
