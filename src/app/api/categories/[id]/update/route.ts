import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function normalizeType(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "income" || s === "expense" || s === "transfer") return s as "income" | "expense" | "transfer";
  return null;
}

function buildDescendants(rows: { id: string; parentId: string | null }[], rootId: string) {
  const childrenByParent = new Map<string, string[]>();
  for (const row of rows) {
    const key = row.parentId ?? "";
    const list = childrenByParent.get(key) ?? [];
    list.push(row.id);
    childrenByParent.set(key, list);
  }

  const descendants = new Set<string>();
  const stack = [...(childrenByParent.get(rootId) ?? [])];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || descendants.has(current)) continue;
    descendants.add(current);
    const children = childrenByParent.get(current) ?? [];
    stack.push(...children);
  }

  return descendants;
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await ctx.params;

  const formData = await req.formData();
  const name = String(formData.get("name") ?? "").trim();
  const type = normalizeType(formData.get("type"));
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Type is required." }, { status: 400 });

  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      type: true,
      parentId: true,
      _count: { select: { transactions: true, children: true } },
    },
  });

  if (!category) {
    return NextResponse.json({ error: "Category not found." }, { status: 404 });
  }

  if (parentId && parentId === id) {
    return NextResponse.json({ error: "A category cannot be its own parent." }, { status: 400 });
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, type: true },
    });
    if (!parent) {
      return NextResponse.json({ error: "Parent category not found." }, { status: 400 });
    }
    if (parent.type !== type) {
      return NextResponse.json({ error: "Parent category type must match." }, { status: 400 });
    }
  }

  if (type !== category.type) {
    if (category._count.transactions > 0 || category._count.children > 0) {
      return NextResponse.json(
        { error: "Category type cannot change while it has transactions or children." },
        { status: 400 }
      );
    }
  }

  if (parentId) {
    const nodes = await prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const descendants = buildDescendants(nodes, id);
    if (descendants.has(parentId)) {
      return NextResponse.json(
        { error: "A category cannot be assigned to one of its descendants." },
        { status: 400 }
      );
    }
  }

  await prisma.category.update({
    where: { id },
    data: { name, type, parentId },
  });

  return NextResponse.json({ ok: true });
}
