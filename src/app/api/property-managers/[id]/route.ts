import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
  await requireUser();
  const { id } = await ctx.params;

  const form = await req.formData();
  const companyName = String(form.get("companyName") ?? "").trim();
  if (!companyName) return new Response("companyName required", { status: 400 });

  const assignmentId = String(form.get("assignmentId") ?? "").trim();
  const propertyId = String(form.get("propertyId") ?? "").trim();

  const startDate = toDate(form.get("startDate"), "startDate");
  if ("error" in startDate) return new Response(startDate.error, { status: 400 });

  const endDate = toDate(form.get("endDate"), "endDate");
  if ("error" in endDate) return new Response(endDate.error, { status: 400 });

  const existing = await prisma.propertyManager.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return NextResponse.redirect(new URL("/property-managers?msg=notfound", req.url));

  await prisma.propertyManager.update({
    where: { id },
    data: {
      companyName,
      contactName: toStr(form.get("contactName")),
      email: toStr(form.get("email")),
      phone: toStr(form.get("phone")),
      website: toStr(form.get("website")),
      address1: toStr(form.get("address1")),
      city: toStr(form.get("city")),
      state: toStr(form.get("state")),
      zip: toStr(form.get("zip")),
    },
  });

  if (propertyId) {
    if (assignmentId) {
      await prisma.propertyManagerAssignment.updateMany({
        where: { id: assignmentId, pmId: id },
        data: {
          propertyId,
          startDate: startDate.value,
          endDate: endDate.value,
          feeType: toStr(form.get("feeType")),
          feeValue: toFloat(form.get("feeValue")),
          notes: toStr(form.get("notes")),
        },
      });
    } else {
      await prisma.propertyManagerAssignment.create({
        data: {
          pmId: id,
          propertyId,
          startDate: startDate.value,
          endDate: endDate.value,
          feeType: toStr(form.get("feeType")),
          feeValue: toFloat(form.get("feeValue")),
          notes: toStr(form.get("notes")),
        },
      });
    }
  } else if (assignmentId) {
    await prisma.propertyManagerAssignment.deleteMany({
      where: { id: assignmentId, pmId: id },
    });
  }

  const redirectUrl = new URL("/property-managers", req.url);
  if (propertyId) redirectUrl.searchParams.set("propertyId", propertyId);
  redirectUrl.searchParams.set("msg", "updated");
  return NextResponse.redirect(redirectUrl);
}
