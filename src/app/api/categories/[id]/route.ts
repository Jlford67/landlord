import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const accountId = await requireAccountId();
  const { id } = await ctx.params;

  const formData = await req.formData();
  const returnToRaw = String(formData.get("returnTo") ?? "").trim();
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/categories";

  const category = await prisma.category.findFirst({
    where: { id, accountId },
    select: { id: true },
  });

  if (!category) {
    return NextResponse.redirect(new URL(`${returnTo}?msg=notfound`, req.url));
  }

  const [childCount, txnCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id, accountId } }),
    prisma.transaction.count({ where: { categoryId: id, property: { accountId } } }),
  ]);

  // If it's referenced, hard-delete is unsafe. Deactivate instead.
  if (childCount > 0 || txnCount > 0) {
    const updateResult = await prisma.category.updateMany({
      where: { id, accountId },
      data: { active: false },
    });

    if (updateResult.count === 0) {
      return NextResponse.redirect(new URL(`${returnTo}?msg=notfound`, req.url));
    }

    return NextResponse.redirect(new URL(`${returnTo}?msg=deactivated`, req.url));
  }

  // Safe to delete
  const deleteResult = await prisma.category.deleteMany({ where: { id, accountId } });
  if (deleteResult.count === 0) {
    return NextResponse.redirect(new URL(`${returnTo}?msg=notfound`, req.url));
  }

  return NextResponse.redirect(new URL(`${returnTo}?msg=deleted`, req.url));
}
