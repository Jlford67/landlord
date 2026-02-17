import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAccountId } from "@/lib/auth";

type RouteParams = {
  params: Promise<{ id: string; txId: string }>;
};

// Support POST (common for undelete) and PATCH (in case something calls it that way)
export async function POST(_: Request, ctx: RouteParams) {
  return handleUndelete(ctx);
}

export async function PATCH(_: Request, ctx: RouteParams) {
  return handleUndelete(ctx);
}

async function handleUndelete(ctx: RouteParams) {
  const accountId = await requireAccountId();
  const { id: propertyId, txId } = await ctx.params;

  const result = await prisma.transaction.updateMany({
    where: {
      id: txId,
      propertyId,
      // only undelete things that are actually deleted
      deletedAt: { not: null },
      property: { accountId },
    },
    data: { deletedAt: null },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
