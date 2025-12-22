import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function toFloat(value: FormDataEntryValue | null) {
  const str = String(value ?? "").replace(/,/g, "").trim();
  if (!str) return null;
  const n = parseFloat(str);
  return Number.isFinite(n) ? n : null;
}

function toDate(value: FormDataEntryValue | null) {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
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

  const existing = await prisma.insurancePolicy.findUnique({ select: { id: true }, where: { id } });
  if (!existing) redirect("/insurance?msg=notfound");

  await prisma.insurancePolicy.update({
    where: { id },
    data: {
      propertyId,
      insurer: toStr(form.get("insurer")),
      policyNum: toStr(form.get("policyNum")),
      agentName: toStr(form.get("agentName")),
      phone: toStr(form.get("phone")),
      premium: toFloat(form.get("premium")),
      dueDate: toDate(form.get("dueDate")),
      paidDate: toDate(form.get("paidDate")),
      webPortal: toStr(form.get("webPortal")),
      allPolicies: toStr(form.get("allPolicies")),
      bank: toStr(form.get("bank")),
      bankNumber: toStr(form.get("bankNumber")),
      loanRef: toStr(form.get("loanRef")),
    },
  });

  redirect("/insurance?msg=updated");
}
