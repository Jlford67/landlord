import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  await requireUser();
  const { contactId } = await ctx.params;

  const form = await req.formData();
  const companyId = String(form.get("companyId") ?? "").trim();
  if (!companyId) return new Response("companyId required", { status: 400 });

  const name = String(form.get("contactName") ?? "").trim();
  if (!name) return new Response("contact name required", { status: 400 });

  await prisma.propertyManagerContact.update({
    where: { id: contactId },
    data: {
      name,
      phone: toStr(form.get("contactPhone")),
      email: toStr(form.get("contactEmail")),
      notes: toStr(form.get("contactNotes")),
    },
  });

  return NextResponse.redirect(
    new URL(`/property-managers/${companyId}/edit?msg=contact-updated&contactId=${contactId}`, req.url),
  );
}
