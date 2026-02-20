import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";
import { toDate } from "../route";

function toFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId();
  const { id } = await ctx.params;

  const form = await req.formData();
  const propertyId = String(form.get("propertyId") ?? "").trim();
  if (!propertyId) return new Response("propertyId required", { status: 400 });

  const property = await prisma.property.findFirst({
    where: { id: propertyId, accountId },
    select: { id: true },
  });
  if (!property) return NextResponse.redirect(new URL("/property-tax?msg=notfound", req.url));

  const dueDate = toDate(form.get("dueDate"), "dueDate");
  if ("error" in dueDate) return new Response(dueDate.error, { status: 400 });

  const lastPaid = toDate(form.get("lastPaid"), "lastPaid");
  if ("error" in lastPaid) return new Response(lastPaid.error, { status: 400 });

  const existing = await prisma.propertyTaxAccount.findFirst({
    select: { id: true },
    where: { id, property: { accountId } },
  });
  if (!existing) return NextResponse.redirect(new URL("/property-tax?msg=notfound", req.url));

  const updateResult = await prisma.propertyTaxAccount.updateMany({
    where: { id, property: { accountId } },
    data: {
      propertyId,
      name: toStr(form.get("name")),
      phone: toStr(form.get("phone")),
      email: toStr(form.get("email")),
      web: toStr(form.get("web")),
      billNumber: toStr(form.get("billNumber")),
      parcel: toStr(form.get("parcel")),
      annualAmount: toFloat(form.get("annualAmount")),
      dueDate: dueDate.value,
      lastPaid: lastPaid.value,
      address1: toStr(form.get("address1")),
      address2: toStr(form.get("address2")),
      city: toStr(form.get("city")),
      state: toStr(form.get("state")),
      zip: toStr(form.get("zip")),
    },
  });
  if (updateResult.count === 0) return NextResponse.redirect(new URL("/property-tax?msg=notfound", req.url));

  return NextResponse.redirect(new URL("/property-tax?msg=updated", req.url));
}
