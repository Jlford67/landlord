import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const accountId = await requireAccountId();
  const { contactId } = await ctx.params;

  const form = await req.formData();
  const companyId = String(form.get("companyId") ?? "").trim();
  if (!companyId) return new Response("companyId required", { status: 400 });

  const name = String(form.get("contactName") ?? "").trim();
  if (!name) return new Response("contact name required", { status: 400 });

  const scopedContact = await prisma.propertyManagerContact.findFirst({
    where: {
      id: contactId,
      company: {
        assignments: {
          some: {
            property: {
              accountId,
            },
          },
        },
      },
    },
    select: { id: true, companyId: true },
  });
  if (!scopedContact) return new Response("Not found", { status: 404 });

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
  if (!scopedCompany || scopedContact.companyId !== companyId) {
    return new Response("Not found", { status: 404 });
  }

  const updateResult = await prisma.propertyManagerContact.updateMany({
    where: {
      id: contactId,
      company: {
        assignments: {
          some: {
            property: {
              accountId,
            },
          },
        },
      },
    },
    data: {
      name,
      phone: toStr(form.get("contactPhone")),
      email: toStr(form.get("contactEmail")),
      notes: toStr(form.get("contactNotes")),
    },
  });
  if (updateResult.count === 0) return new Response("Not found", { status: 404 });

  return NextResponse.redirect(
    new URL(`/property-managers/${companyId}/edit?msg=contact-updated&contactId=${contactId}`, req.url),
  );
}
