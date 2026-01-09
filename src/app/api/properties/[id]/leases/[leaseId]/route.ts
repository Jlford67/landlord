import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { LeaseStatus } from "@prisma/client";

function parseDateOnly(value: string): Date {
  const [y, m, d] = value.split("-").map((x) => parseInt(x, 10));
  if (!y || !m || !d) throw new Error(`Invalid date: ${value}`);
  return new Date(y, m - 1, d);
}

export async function POST(
  req: Request,
  ctx:
    | { params: { id: string; leaseId: string } }
    | { params: Promise<{ id: string; leaseId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const paramsMaybePromise = (ctx as any).params;
    const p =
      typeof paramsMaybePromise?.then === "function"
        ? await paramsMaybePromise
        : paramsMaybePromise;

    const propertyId = p?.id;
    const leaseId = p?.leaseId;

    if (!propertyId || !leaseId) {
      return NextResponse.json({ error: "Missing route params" }, { status: 400 });
    }

    const formData = await req.formData();
    const action = (formData.get("_action")?.toString() || "update").trim();

    // END action
    if (action === "end") {
      const endDateRaw = (formData.get("endDate")?.toString() || "").trim();
      const endDate = endDateRaw ? parseDateOnly(endDateRaw) : new Date();

      await prisma.lease.update({
        where: { id: leaseId },
        data: { status: "ended", endDate },
      });

      return NextResponse.redirect(new URL(`/properties/${propertyId}/leases`, req.url));
    }

    // UPDATE action
    const startDateRaw = (formData.get("startDate")?.toString() || "").trim();
    const endDateRaw = (formData.get("endDate")?.toString() || "").trim();
    const unitLabelRaw = (formData.get("unitLabel")?.toString() || "").trim();
    const rentAmountRaw = (formData.get("rentAmount")?.toString() || "").trim();
    const dueDayRaw = (formData.get("dueDay")?.toString() || "").trim();
    const depositRaw = (formData.get("deposit")?.toString() || "").trim();
    const statusRaw = (formData.get("status")?.toString() || "active").trim();
    const managedByPm = formData.get("managedByPm") === "on";
    const notesRaw = (formData.get("notes")?.toString() || "").trim();
    const tenantIds = Array.from(
      new Set(formData.getAll("tenantIds").map((v) => v.toString()).filter(Boolean))
    );

    if (!startDateRaw || !rentAmountRaw || !dueDayRaw) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const rentAmount = Number(rentAmountRaw);
    const dueDay = Number(dueDayRaw);

    if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
      return NextResponse.json({ error: "Invalid rent amount" }, { status: 400 });
    }
    if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
      return NextResponse.json({ error: "Invalid due day" }, { status: 400 });
    }

    const startDate = parseDateOnly(startDateRaw);
    const endDate = endDateRaw ? parseDateOnly(endDateRaw) : null;

    const deposit = depositRaw.length === 0 ? null : Number(depositRaw);
    if (deposit !== null && !Number.isFinite(deposit)) {
      return NextResponse.json({ error: "Invalid deposit" }, { status: 400 });
    }

    const status: LeaseStatus =
      statusRaw === "upcoming" || statusRaw === "active" || statusRaw === "ended"
        ? (statusRaw as LeaseStatus)
        : "active";

    await prisma.$transaction(async (tx) => {
      const lease = await tx.lease.findUnique({ where: { id: leaseId } });
      if (!lease) throw new Error(`Lease not found: ${leaseId}`);
      if (lease.propertyId !== propertyId) throw new Error("Lease/property mismatch");

      await tx.lease.update({
        where: { id: leaseId },
        data: {
          startDate,
          endDate,
          rentAmount,
          dueDay,
          deposit,
          unitLabel: unitLabelRaw.length ? unitLabelRaw : null,
          status,
          managedByPm,
          notes: notesRaw.length ? notesRaw : null,
        },
      });

      const existing = await tx.leaseTenant.findMany({
        where: { leaseId },
        select: { tenantId: true },
      });
      const existingIds = new Set(existing.map((row) => row.tenantId));
      const incomingIds = new Set(tenantIds);

      const toRemove = existing
        .map((row) => row.tenantId)
        .filter((tenantId) => !incomingIds.has(tenantId));
      const toAdd = tenantIds.filter((tenantId) => !existingIds.has(tenantId));

      if (toRemove.length) {
        await tx.leaseTenant.deleteMany({
          where: { leaseId, tenantId: { in: toRemove } },
        });
      }

      if (toAdd.length) {
        await tx.leaseTenant.createMany({
          data: toAdd.map((tenantId) => ({
            leaseId,
            tenantId,
            role: tenantIds.indexOf(tenantId) === 0 ? "primary" : "additional",
          })),
        });
      }
    });

    return NextResponse.redirect(new URL(`/properties/${propertyId}/leases`, req.url));
  } catch (err: any) {
    return NextResponse.json(
      { error: "Lease update failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
