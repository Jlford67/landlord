import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAccountId } from "@/lib/auth";

type RouteParams = {
  params: Promise<{ id: string; txId: string }>;
};

export async function GET(_: Request, ctx: RouteParams) {
  const accountId = await requireAccountId();
  const { id: propertyId, txId } = await ctx.params;

  const txn = await prisma.transaction.findFirst({
    where: {
      id: txId,
      propertyId,
      deletedAt: null,
      property: { accountId },
    },
  });

  if (!txn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(txn);
}

export async function PATCH(req: Request, ctx: RouteParams) {
  const accountId = await requireAccountId();
  const { id: propertyId, txId } = await ctx.params;

  // Body should be a partial Transaction update.
  // We keep it permissive since this is an internal API route, but scoped.
  const data = (await req.json()) as Record<string, unknown>;

  const result = await prisma.transaction.updateMany({
    where: {
      id: txId,
      propertyId,
      deletedAt: null,
      property: { accountId },
    },
    data,
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Return the updated row (still scoped)
  const updated = await prisma.transaction.findFirst({
    where: {
      id: txId,
      propertyId,
      deletedAt: null,
      property: { accountId },
    },
  });

  return NextResponse.json(updated);
}
