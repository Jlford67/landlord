import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ companyId: string }> }) {
  await requireUser();
  const { companyId } = await ctx.params;

  const form = await req.formData();
  const name = String(form.get("contactName") ?? "").trim();
  if (!name) return new Response("contact name required", { status: 400 });

  await prisma.propertyManagerContact.create({
    data: {
      companyId,
      name,
      phone: toStr(form.get("contactPhone")),
      email: toStr(form.get("contactEmail")),
      notes: toStr(form.get("contactNotes")),
    },
  });

  return NextResponse.redirect(
    new URL(`/property-managers/${companyId}/edit?msg=contact-added`, req.url),
  );
}
