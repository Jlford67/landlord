import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ companyId: string }> }) {
  const accountId = await requireAccountId();
  const { companyId } = await ctx.params;

  const scopedCompany = await prisma.propertyManagerCompany.findFirst({
    where: {
      id: companyId,
      assignments: {
        some: {
          property: {
            accountId,
          },
        },
      },
    },
    select: { id: true },
  });
  if (!scopedCompany) return new Response("Not found", { status: 404 });

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
