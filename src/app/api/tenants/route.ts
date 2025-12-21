import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  await requireUser();

  const tenants = await prisma.tenant.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  return NextResponse.json({ tenants });
}

export async function POST(req: Request) {
  await requireUser();

  const formData = await req.formData();

  const returnTo = (formData.get("returnTo")?.toString() || "/").trim();

  const firstName = (formData.get("firstName")?.toString() || "").trim();
  const lastName = (formData.get("lastName")?.toString() || "").trim();

  const emailRaw = (formData.get("email")?.toString() || "").trim();
  const phoneRaw = (formData.get("phone")?.toString() || "").trim();
  const notesRaw = (formData.get("notes")?.toString() || "").trim();

  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  await prisma.tenant.create({
    data: {
      firstName,
      lastName,
      email: emailRaw.length ? emailRaw : null,
      phone: phoneRaw.length ? phoneRaw : null,
      notes: notesRaw.length ? notesRaw : null,
    },
  });

  return NextResponse.redirect(new URL(returnTo, req.url));
}
