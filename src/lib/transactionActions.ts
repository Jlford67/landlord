"use server";

import { prisma } from "@/lib/db";
import { requireUser, requireAccountId } from "@/lib/auth";

export async function deleteTransaction(id: string) {
  await requireUser();
  const accountId = await requireAccountId();

  await prisma.transaction.updateMany({
    where: {
      id,
      deletedAt: null,
      property: { accountId },
    },
    data: { deletedAt: new Date() },
  });
}

