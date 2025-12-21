import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_NAME, getCurrentUser } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (user) {
      await prisma.session.deleteMany({
        where: { userId: user.id },
      });
    }
  } catch {
    // swallow errors so logout never 500s
  }

  // In Next.js 16+ in your environment, cookies() is async here
  const cookieStore = await cookies();

  cookieStore.set(COOKIE_NAME, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return NextResponse.redirect(new URL("/login", req.url));
}
