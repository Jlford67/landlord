import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  const formData = await req.formData();
  const returnToRaw = String(formData.get("returnTo") ?? "").trim();
  const returnTo = returnToRaw && returnToRaw.startsWith("/") ? returnToRaw : "/categories";

  const category = await prisma.category.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!category) {
    return NextResponse.redirect(new URL(`${returnTo}?msg=notfound`, req.url));
  }

  const [childCount, txnCount] = await Promise.all([
    prisma.category.count({ where: { parentId: id } }),
    prisma.transaction.count({ where: { categoryId: id } }),
  ]);

  // If it's referenced, hard-delete is unsafe. Deactivate instead.
  if (childCount > 0 || txnCount > 0) {
    await prisma.category.update({
      where: { id },
      data: { active: false },
    });

    return NextResponse.redirect(new URL(`${returnTo}?msg=deactivated`, req.url));
  }

  // Safe to delete
  await prisma.category.delete({ where: { id } });
  return NextResponse.redirect(new URL(`${returnTo}?msg=deleted`, req.url));
}
