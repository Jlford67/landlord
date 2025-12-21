export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    if (!user) return NextResponse.redirect(new URL("/login", req.url));

    const form = await req.formData();

    const nickname = String(form.get("nickname") ?? "").trim();
    const street = String(form.get("street") ?? "").trim();
    const city = String(form.get("city") ?? "").trim();
    const state = String(form.get("state") ?? "").trim();
    const zip = String(form.get("zip") ?? "").trim();

    await prisma.property.create({
      data: {
        nickname: nickname || null,
        street,
        city,
        state,
        zip,
      },
    });

    return NextResponse.redirect(new URL("/properties", req.url));
  } catch (err) {
    console.error("PROPERTIES POST ERROR:", err);
    return new Response("Failed to create property (see server console).", { status: 500 });
  }
}
