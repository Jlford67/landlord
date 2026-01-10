import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ contactId: string }> }) {
  await requireUser();
  const { contactId } = await ctx.params;

  const form = await req.formData();
  const companyId = String(form.get("companyId") ?? "").trim();
  if (!companyId) return new Response("companyId required", { status: 400 });

  await prisma.propertyManagerContact.delete({
    where: { id: contactId },
  });

  return NextResponse.redirect(
    new URL(`/property-managers/${companyId}/edit?msg=contact-deleted&contactId=${contactId}`, req.url),
  );
}
