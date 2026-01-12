"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";

function toStr(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  return str || null;
}

export async function createPropertyManagerCompany(formData: FormData) {
  const name = toStr(formData.get("name")).trim();
  if (!name) throw new Error("Company name is required.");

  const phone = toStr(formData.get("phone"));
  const email = toStr(formData.get("email"));
  const website = toStr(formData.get("website"));
  const notes = toStr(formData.get("notes"));

  // 1) Pre-check to avoid throwing
  const existing = await prisma.propertyManagerCompany.findUnique({
    where: { name },
    select: { id: true },
  });

  if (existing) {
    // If you want: redirect them to edit instead of erroring
    // redirect(`/property-managers/${existing.id}/edit?msg=${encodeURIComponent("Company already exists.")}`);

    // Minimal behavior: throw a friendly error (your UI likely shows it)
    throw new Error(`A property manager company named "${name}" already exists.`);
  }

  // 2) Create, with a catch as a safety net (race condition / double submit)
  try {
    await prisma.propertyManagerCompany.create({
      data: {
        name,
        phone,
        email,
        website,
        notes,
      },
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error(`A property manager company named "${name}" already exists.`);
    }
    throw err;
  }
}


export async function updatePropertyManagerCompany(id: string, formData: FormData) {
  await requireUser();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Company name is required.");

  await prisma.propertyManagerCompany.update({
    where: { id },
    data: {
      name,
      phone: toStr(formData.get("phone")),
      email: toStr(formData.get("email")),
      website: toStr(formData.get("website")),
      address1: toStr(formData.get("address1")),
      city: toStr(formData.get("city")),
      state: toStr(formData.get("state")),
      zip: toStr(formData.get("zip")),
      notes: toStr(formData.get("notes")),
    },
  });

  redirect(`/property-managers/${id}/edit?msg=updated`);
}

export async function createPropertyManagerContact(companyId: string, formData: FormData) {
  await requireUser();

  const name = String(formData.get("contactName") ?? "").trim();
  if (!name) throw new Error("Contact name is required.");

  await prisma.propertyManagerContact.create({
    data: {
      companyId,
      name,
      phone: toStr(formData.get("contactPhone")),
      email: toStr(formData.get("contactEmail")),
      notes: toStr(formData.get("contactNotes")),
    },
  });

  redirect(`/property-managers/${companyId}/edit?msg=contact-added`);
}

export async function updatePropertyManagerContact(contactId: string, companyId: string, formData: FormData) {
  await requireUser();

  const name = String(formData.get("contactName") ?? "").trim();
  if (!name) throw new Error("Contact name is required.");

  await prisma.propertyManagerContact.update({
    where: { id: contactId },
    data: {
      name,
      phone: toStr(formData.get("contactPhone")),
      email: toStr(formData.get("contactEmail")),
      notes: toStr(formData.get("contactNotes")),
    },
  });

  redirect(`/property-managers/${companyId}/edit?msg=contact-updated&contactId=${contactId}`);
}

export async function deletePropertyManagerContact(contactId: string, companyId: string) {
  await requireUser();

  await prisma.propertyManagerContact.delete({
    where: { id: contactId },
  });

  redirect(`/property-managers/${companyId}/edit?msg=contact-deleted&contactId=${contactId}`);
}

export async function deletePropertyManagerCompany(companyId: string) {
  await requireUser();

  await prisma.$transaction([
    prisma.propertyManagerAssignment.deleteMany({ where: { companyId } }),
    prisma.propertyManagerContact.deleteMany({ where: { companyId } }),
    prisma.propertyManagerCompany.delete({ where: { id: companyId } }),
  ]);

  redirect("/property-managers?msg=deleted");
}
