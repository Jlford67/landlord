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

function toCents(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function toWholeDollars(value: FormDataEntryValue | null) {
  const str = String(value ?? "")
    .replace(/[$,]/g, "")
    .trim();
  if (!str) return null;
  if (!/^\d+$/.test(str)) return null;
  const n = parseInt(str, 10);
  return Number.isFinite(n) ? n : null;
}

function toUrl(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  if (!str) return null;
  if (!/^https?:\/\//i.test(str)) return null;
  return str;
}

function toDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(str)) return null;
  const [yy, mm, dd] = str.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
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

    const zillowEstimatedValue = toWholeDollars(form.get("zillowEstimatedValue"));
    const redfinEstimatedValue = toWholeDollars(form.get("redfinEstimatedValue"));

    if (form.get("zillowEstimatedValue") && zillowEstimatedValue === null) {
      return new Response("Zillow estimate must be a whole number.", { status: 400 });
    }

    if (form.get("redfinEstimatedValue") && redfinEstimatedValue === null) {
      return new Response("Redfin estimate must be a whole number.", { status: 400 });
    }

    const zillowUrl = toUrl(form.get("zillowUrl"));
    const redfinUrl = toUrl(form.get("redfinUrl"));

    if (form.get("zillowUrl") && zillowUrl === null) {
      return new Response("Zillow URL must start with http:// or https://.", { status: 400 });
    }

    if (form.get("redfinUrl") && redfinUrl === null) {
      return new Response("Redfin URL must start with http:// or https://.", { status: 400 });
    }

    const now = new Date();

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
        purchasePriceCents: toCents(form.get("purchasePrice")),
        purchaseDate: toDate(form.get("purchaseDate")),
        soldPriceCents: toCents(form.get("soldPrice")),
        soldDate: toDate(form.get("soldDate")),
        zillowEstimatedValue,
        zillowEstimatedValueUpdatedAt: zillowEstimatedValue === null ? null : now,
        redfinEstimatedValue,
        redfinEstimatedValueUpdatedAt: redfinEstimatedValue === null ? null : now,
        zillowUrl,
        redfinUrl,
      },
    });

    return NextResponse.redirect(new URL(`/properties/${id}`, req.url));
  } catch (err) {
    console.error("PROPERTY UPDATE ERROR:", err);
    return new Response("Failed to update property (see server console).", { status: 500 });
  }
}
