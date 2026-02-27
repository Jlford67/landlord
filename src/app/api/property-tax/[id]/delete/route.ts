import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId();
  const { id } = await ctx.params;

  const deleteResult = await prisma.propertyTaxAccount.deleteMany({ where: { id, property: { accountId } } });
  if (deleteResult.count === 0) return NextResponse.redirect(new URL("/property-tax?msg=notfound", req.url));

  return NextResponse.redirect(new URL("/property-tax?msg=deleted", req.url));
}
