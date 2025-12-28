"use server";

import { prisma } from "@/lib/db";

export async function deleteTransaction(id: string) {
  await prisma.transaction.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

export async function undeleteTransaction(id: string) {
  await prisma.transaction.update({
    where: { id },
    data: { deletedAt: null },
  });
}
