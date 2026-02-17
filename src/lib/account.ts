import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

export async function requireAccountId() {
  const user = await requireUser();

  const membership = await prisma.accountMember.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
    select: { accountId: true },
  });

  if (!membership) {
    // If you ever land here, it means backfill didn't attach the user to an Account
    throw new Error("No account membership found for current user");
  }

  return membership.accountId;
}
