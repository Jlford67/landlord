import { NextResponse } from "next/server";
import { requireAccountId } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const accountId = await requireAccountId();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const zillowUrl = ((body as any)?.zillowUrl ?? "").toString().trim();
  const redfinUrl = ((body as any)?.redfinUrl ?? "").toString().trim();

  const updateResult = await prisma.property.updateMany({
    where: { id, accountId },
    data: {
      zillowUrl: zillowUrl || null,
      redfinUrl: redfinUrl || null,
    },
  });

  if (updateResult.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
