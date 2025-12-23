import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function toStr(value: FormDataEntryValue | null) {
  const v = String(value ?? "").trim();
  return v || null;
}

function toInt(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
}

function toFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  try {
    const existing = await prisma.property.findUnique({ select: { id: true }, where: { id } });
    if (!existing) return NextResponse.redirect(new URL("/properties?msg=notfound", req.url));

    const form = await req.formData();

    const street = String(form.get("street") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const state = String(form.get("state") ?? "").trim();
    const zip = String(form.get("zip") ?? "").trim();

    if (!street || !city || !state || !zip)
      return new Response("Street, city, state, and ZIP are required.", { status: 400 });

    await prisma.property.update({
      where: { id },
      data: {
        nickname: toStr(form.get("nickname")),
        street,
        city,
        state,
        zip,
        status: toStr(form.get("status")) ?? "active",
        doors: toInt(form.get("doors")),
        beds: toFloat(form.get("beds")),
        baths: toFloat(form.get("baths")),
        sqFt: toInt(form.get("sqFt")),
        notes: toStr(form.get("notes")),
      },
    });

    return NextResponse.redirect(new URL(`/properties/${id}`, req.url));
  } catch (err) {
    console.error("PROPERTY UPDATE ERROR:", err);
    return new Response("Failed to update property (see server console).", { status: 500 });
  }
}
