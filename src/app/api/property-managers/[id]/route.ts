import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return new Response("name required", { status: 400 });

  const existing = await prisma.propertyManagerCompany.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return NextResponse.redirect(new URL("/property-managers?msg=notfound", req.url));

  await prisma.propertyManagerCompany.update({
    where: { id },
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

  return NextResponse.redirect(new URL(`/property-managers/${id}/edit?msg=updated`, req.url));
}
