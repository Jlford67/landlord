import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string; txId: string }> | { id: string; txId: string } }
) {
  await requireUser();

  const p = await Promise.resolve(ctx.params as any);
  const propertyId = String(p.id ?? "");
  const txId = String(p.txId ?? "");

  const form = await req.formData();
  const month = String(form.get("month") ?? "").trim();

  // Undo delete (soft-delete uses deletedAt)
  await prisma.transaction.updateMany({
    where: { id: txId, propertyId },
    data: { deletedAt: null },
  });

  const qsMonth = month && /^\d{4}-\d{2}$/.test(month) ? `&month=${encodeURIComponent(month)}` : "";
  return NextResponse.redirect(
    new URL(`/properties/${propertyId}/ledger?msg=restored${qsMonth}`, req.url)
  );
}
