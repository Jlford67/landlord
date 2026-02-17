import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAccountId } from "@/lib/auth";

type RouteParams = {
  params: Promise<{ id: string; txId: string }>;
};

// Prefer POST for “delete” actions (since the folder is /delete/),
// but also support DELETE in case something calls it directly.
export async function POST(_: Request, ctx: RouteParams) {
  return handleSoftDelete(ctx);
}

export async function DELETE(_: Request, ctx: RouteParams) {
  return handleSoftDelete(ctx);
}

async function handleSoftDelete(ctx: RouteParams) {
  const accountId = await requireAccountId();
  const { id: propertyId, txId } = await ctx.params;

  // Soft-delete scoped to account + property + not-already-deleted
  const result = await prisma.transaction.updateMany({
    where: {
      id: txId,
      propertyId,
      deletedAt: null,
      property: { accountId },
    },
    data: { deletedAt: new Date() },
  });

  if (result.count === 0) {
    // Either not found, already deleted, wrong propertyId, or wrong accountId
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
