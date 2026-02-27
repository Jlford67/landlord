"use server";

import { prisma } from "@/lib/db";
import { requireAccountId } from "@/lib/auth";

export async function deleteTransaction(id: string) {
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
