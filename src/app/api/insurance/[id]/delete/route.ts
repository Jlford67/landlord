import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  await prisma.insurancePolicy.delete({ where: { id } });

  return NextResponse.redirect(new URL("/insurance?msg=deleted", req.url));
}
