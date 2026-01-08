"use server";

import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { redirect } from "next/navigation";

export async function deleteTenant(tenantId: string) {
  await requireUser();

  const leaseCount = await prisma.leaseTenant.count({ where: { tenantId } });
  if (leaseCount > 0) {
    redirect("/tenants?msg=blocked");
  }

  await prisma.tenant.delete({ where: { id: tenantId } });

  redirect("/tenants?msg=deleted");
}
