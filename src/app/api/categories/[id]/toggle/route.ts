import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  await requireUser();

  const { id } = await ctx.params;

  const form = await req.formData();
  const returnTo = String(form.get("returnTo") ?? "/categories");

  const cat = await prisma.category.findUnique({
    where: { id },
    select: { id: true, active: true },
  });

  if (!cat) {
    return NextResponse.redirect(new URL(`${returnTo}?msg=notfound`, req.url));
  }

  // If trying to disable, block when there are active children
  if (cat.active) {
    const activeChildCount = await prisma.category.count({
      where: { parentId: id, active: true },
    });

    if (activeChildCount > 0) {
      return NextResponse.redirect(
        new URL(`${returnTo}?msg=disable_children_first`, req.url)
      );
    }
  }

  await prisma.category.update({
    where: { id },
    data: { active: !cat.active },
  });

  const msg = !cat.active ? "activated" : "deactivated";
  return NextResponse.redirect(new URL(`${returnTo}?msg=${msg}`, req.url));
}
