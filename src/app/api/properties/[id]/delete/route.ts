import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  await requireUser();

  const p = await Promise.resolve(ctx.params as any);
  const id = p.id as string;

  const row = await prisma.property.findUnique({
    where: { id },
    select: { id: true, _count: { select: { leases: true, transactions: true } } },
  });

  if (!row) {
    return NextResponse.redirect(new URL(`/properties?msg=notfound`, req.url));
  }

  const hasRelated = row._count.leases > 0 || row._count.transactions > 0;

  if (hasRelated) {
    await prisma.property.update({
      where: { id },
      data: { status: "inactive" },
    });
    return NextResponse.redirect(new URL(`/properties?msg=deactivated`, req.url));
  }

  await prisma.property.delete({ where: { id } });
  return NextResponse.redirect(new URL(`/properties?msg=deleted`, req.url));
}
