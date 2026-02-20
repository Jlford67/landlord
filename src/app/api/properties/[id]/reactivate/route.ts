import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> | { id: string } }
) {
  const accountId = await requireAccountId();

  const p = await Promise.resolve(ctx.params as any);
  const id = p.id as string;

  const row = await prisma.property.findFirst({
    where: { id, accountId },
    select: { id: true },
  });

  if (!row) {
    return NextResponse.redirect(new URL(`/properties?msg=notfound`, req.url));
  }

  const updateResult = await prisma.property.updateMany({
    where: { id, accountId },
    data: { status: "active" },
  });

  if (updateResult.count === 0) {
    return NextResponse.redirect(new URL(`/properties?msg=notfound`, req.url));
  }

  return NextResponse.redirect(new URL(`/properties?msg=reactivated`, req.url));
}
