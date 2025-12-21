export const runtime = "nodejs";

import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";

const COOKIE_NAME = "ll_session";
const SESSION_DAYS = 14;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function POST(req: Request) {
  try {
    const form = await req.formData();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return NextResponse.redirect(new URL("/login", req.url));

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return NextResponse.redirect(new URL("/login", req.url));

    const token = crypto.randomBytes(32).toString("hex");
    const tokenHash = sha256(token);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

    await prisma.session.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const res = NextResponse.redirect(new URL("/properties", req.url));
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: expiresAt,
    });

    return res;
  } catch (err) {
    console.error("LOGIN ERROR:", err);
    return new Response("Login failed (see server console).", { status: 500 });
  }
}
