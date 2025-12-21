import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function normalizeType(v: FormDataEntryValue | null) {
  const s = String(v ?? "").trim().toLowerCase();
  if (s === "income" || s === "expense" || s === "transfer") return s as "income" | "expense" | "transfer";
  return null;
}

export async function POST(req: Request) {
  await requireUser();

  const formData = await req.formData();
  const name = String(formData.get("name") ?? "").trim();
  const type = normalizeType(formData.get("type"));
  const parentIdRaw = String(formData.get("parentId") ?? "").trim();
  const parentId = parentIdRaw ? parentIdRaw : null;

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (!type) return NextResponse.json({ error: "Type is required." }, { status: 400 });

  const existing = await prisma.category.findFirst({
    where: { type, name },
    select: { id: true },
  });

  if (existing) {
    return NextResponse.redirect(new URL("/categories?msg=exists", req.url));
  }

  if (parentId) {
    const parent = await prisma.category.findUnique({
      where: { id: parentId },
      select: { id: true, type: true },
    });
    if (!parent) return NextResponse.json({ error: "Parent category not found." }, { status: 400 });
    if (parent.type !== type) {
      return NextResponse.json({ error: "Parent category type must match." }, { status: 400 });
    }
  }

  await prisma.category.create({
    data: { name, type, active: true, parentId },
  });

  return NextResponse.redirect(new URL("/categories?msg=created", req.url));
}
