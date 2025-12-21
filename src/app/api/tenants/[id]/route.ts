import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export async function POST(
  req: Request,
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const paramsMaybePromise = (ctx as any).params;
    const p =
      typeof paramsMaybePromise?.then === "function"
        ? await paramsMaybePromise
        : paramsMaybePromise;

    const id = p?.id;
    if (!id) return NextResponse.json({ error: "Missing tenant id" }, { status: 400 });

    const formData = await req.formData();

    const firstName = (formData.get("firstName")?.toString() || "").trim();
    const lastName = (formData.get("lastName")?.toString() || "").trim();
    const emailRaw = (formData.get("email")?.toString() || "").trim();
    const phoneRaw = (formData.get("phone")?.toString() || "").trim();
    const notesRaw = (formData.get("notes")?.toString() || "").trim();

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "First and last name are required" }, { status: 400 });
    }

    await prisma.tenant.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email: emailRaw.length ? emailRaw : null,
        phone: phoneRaw.length ? phoneRaw : null,
        notes: notesRaw.length ? notesRaw : null,
      },
    });

    return NextResponse.redirect(new URL(`/tenants/${id}`, req.url));
  } catch (err: any) {
    return NextResponse.json(
      { error: "Tenant update failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
