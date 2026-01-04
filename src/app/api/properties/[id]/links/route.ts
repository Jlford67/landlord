import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireUser();

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const zillowUrl = ((body as any)?.zillowUrl ?? "").toString().trim();
  const redfinUrl = ((body as any)?.redfinUrl ?? "").toString().trim();

  await prisma.property.update({
    where: { id },
    data: {
      zillowUrl: zillowUrl || null,
      redfinUrl: redfinUrl || null,
    },
  });

  return NextResponse.json({ ok: true });
}
