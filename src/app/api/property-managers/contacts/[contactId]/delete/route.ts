import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  const accountId = await requireAccountId();
  const { contactId } = await ctx.params;

  const form = await req.formData();
  const companyId = String(form.get("companyId") ?? "").trim();
  if (!companyId) return new Response("companyId required", { status: 400 });

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
  if (!scopedContact || scopedContact.companyId !== companyId) {
    return new Response("Not found", { status: 404 });
  }

  const deleteResult = await prisma.propertyManagerContact.deleteMany({
    where: {
      id: contactId,
      companyId,
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
  });
  if (deleteResult.count === 0) return new Response("Not found", { status: 404 });

  return NextResponse.redirect(
    new URL(`/property-managers/${companyId}/edit?msg=contact-deleted&contactId=${contactId}`, req.url),
  );
}
