import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request) {
  await requireUser();

  const form = await req.formData();

  const name = String(form.get("name") ?? "").trim();
  if (!name) return new Response("name required", { status: 400 });

  await prisma.propertyManagerCompany.create({
    data: {
      name,
      phone: toStr(form.get("phone")),
      email: toStr(form.get("email")),
      website: toStr(form.get("website")),
      address1: toStr(form.get("address1")),
      city: toStr(form.get("city")),
      state: toStr(form.get("state")),
      zip: toStr(form.get("zip")),
      notes: toStr(form.get("notes")),
    },
  });

  return NextResponse.redirect(new URL("/property-managers?msg=created", req.url));
}
