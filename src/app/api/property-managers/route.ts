import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type DateParseResult = { value: Date | null } | { error: string };

function toFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

export function toDate(value: FormDataEntryValue | null, fieldName: string): DateParseResult {
  if (value && typeof value === "object" && "arrayBuffer" in value) {
    return { error: `Invalid ${fieldName} date` };
  }

  const str = String(value ?? "").trim();
  if (!str) return { value: null };

  let candidate = str;

  if (str.startsWith("{") || str.startsWith("[")) {
    try {
      const parsed = JSON.parse(str);
      if (
        parsed &&
        typeof parsed === "object" &&
        "value" in parsed &&
        "$type" in parsed &&
        parsed.$type === "DateTime" &&
        typeof parsed.value === "string"
      ) {
        candidate = parsed.value.trim();
        if (!candidate) return { value: null };
      }
    } catch {
      // ignore JSON parse errors; fall back to raw string
    }
  }

  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) {
    return { error: `Invalid ${fieldName} date` };
  }

  return { value: d };
}

function toStr(value: FormDataEntryValue | null) {
  const s = String(value ?? "").trim();
  return s || null;
}

export async function POST(req: Request) {
  await requireUser();

  const form = await req.formData();
  const companyName = String(form.get("companyName") ?? "").trim();
  if (!companyName) return new Response("companyName required", { status: 400 });

  const propertyId = String(form.get("propertyId") ?? "").trim();

  const startDate = toDate(form.get("startDate"), "startDate");
  if ("error" in startDate) return new Response(startDate.error, { status: 400 });

  const endDate = toDate(form.get("endDate"), "endDate");
  if ("error" in endDate) return new Response(endDate.error, { status: 400 });

  const manager = await prisma.propertyManager.create({
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
    await prisma.propertyManagerAssignment.create({
      data: {
        pmId: manager.id,
        propertyId,
        startDate: startDate.value,
        endDate: endDate.value,
        feeType: toStr(form.get("feeType")),
        feeValue: toFloat(form.get("feeValue")),
        notes: toStr(form.get("notes")),
      },
    });
  }

  const redirectUrl = new URL("/property-managers", req.url);
  if (propertyId) redirectUrl.searchParams.set("propertyId", propertyId);
  redirectUrl.searchParams.set("msg", "created");
  return NextResponse.redirect(redirectUrl);
}
