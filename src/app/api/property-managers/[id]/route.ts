import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId();
  const { id } = await ctx.params;

  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  if (!name) return new Response("name required", { status: 400 });

  const existing = await prisma.propertyManagerCompany.findFirst({
    select: { id: true },
    where: {
      id,
      assignments: {
        some: {
          property: {
            accountId,
          },
        },
      },
    },
  });
  if (!existing) return new Response("Not found", { status: 404 });

  const updateResult = await prisma.propertyManagerCompany.updateMany({
    where: {
      id,
      assignments: {
        some: {
          property: {
            accountId,
          },
        },
      },
    },
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
  if (updateResult.count === 0) return new Response("Not found", { status: 404 });

  return NextResponse.redirect(new URL(`/property-managers/${id}/edit?msg=updated`, req.url));
}
