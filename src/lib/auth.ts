import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

export const COOKIE_NAME = "ll_session";

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;

  if (!token) return null;

  const tokenHash = sha256(token);

  const session = await prisma.session.findFirst({
    where: {
      tokenHash,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  return session?.user ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  return user;
}
