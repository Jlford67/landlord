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
    select: { id: true },
  });

  if (!row) {
    return NextResponse.redirect(new URL(`/properties?msg=notfound`, req.url));
  }

  await prisma.property.update({
    where: { id },
    data: { status: "active" },
  });

  return NextResponse.redirect(new URL(`/properties?msg=reactivated`, req.url));
}
