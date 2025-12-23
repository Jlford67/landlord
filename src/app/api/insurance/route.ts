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

  const propertyId = String(form.get("propertyId") ?? "").trim();
  if (!propertyId) return new Response("propertyId required", { status: 400 });

  const dueDate = toDate(form.get("dueDate"), "dueDate");
  if ("error" in dueDate) return new Response(dueDate.error, { status: 400 });

  const paidDate = toDate(form.get("paidDate"), "paidDate");
  if ("error" in paidDate) return new Response(paidDate.error, { status: 400 });

  await prisma.insurancePolicy.create({
    data: {
      propertyId,
      insurer: toStr(form.get("insurer")),
      policyNum: toStr(form.get("policyNum")),
      agentName: toStr(form.get("agentName")),
      phone: toStr(form.get("phone")),
      premium: toFloat(form.get("premium")),
      dueDate: dueDate.value,
      paidDate: paidDate.value,
      webPortal: toStr(form.get("webPortal")),
      allPolicies: toStr(form.get("allPolicies")),
      bank: toStr(form.get("bank")),
      bankNumber: toStr(form.get("bankNumber")),
      loanRef: toStr(form.get("loanRef")),
    },
  });

  return NextResponse.redirect(new URL("/insurance?msg=created", req.url));
}
