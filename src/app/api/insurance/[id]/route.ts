import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { toDate } from "../route";

function toFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/[$,]/g, "").trim();
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
  const propertyId = String(form.get("propertyId") ?? "").trim();
  if (!propertyId) return new Response("propertyId required", { status: 400 });

  const dueDate = toDate(form.get("dueDate"), "dueDate");
  if ("error" in dueDate) return new Response(dueDate.error, { status: 400 });

  const paidDate = toDate(form.get("paidDate"), "paidDate");
  if ("error" in paidDate) return new Response(paidDate.error, { status: 400 });
  const autoPayMonthly = form.get("autoPayMonthly") === "on";

  const existing = await prisma.insurancePolicy.findUnique({ select: { id: true }, where: { id } });
  if (!existing) return NextResponse.redirect(new URL("/insurance?msg=notfound", req.url));

  await prisma.insurancePolicy.update({
    where: { id },
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
      autoPayMonthly,
    },
  });

  return NextResponse.redirect(new URL("/insurance?msg=updated", req.url));
}
