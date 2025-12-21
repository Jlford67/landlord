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

    // Next 16: params may be a Promise
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

    if (action === "end") {
      const endDateRaw = (formData.get("endDate")?.toString() || "").trim();
      const endDate = endDateRaw ? parseDateOnly(endDateRaw) : new Date();

      await prisma.lease.update({
        where: { id: leaseId },
        data: {
          status: "ended",
          endDate,
        },
      });

      return NextResponse.redirect(new URL(`/properties/${propertyId}/leases`, req.url));
    }

    // update
    const startDateRaw = (formData.get("startDate")?.toString() || "").trim();
    const endDateRaw = (formData.get("endDate")?.toString() || "").trim();
    const rentAmountRaw = (formData.get("rentAmount")?.toString() || "").trim();
    const dueDayRaw = (formData.get("dueDay")?.toString() || "").trim();
    const depositRaw = (formData.get("deposit")?.toString() || "").trim();
    const statusRaw = (formData.get("status")?.toString() || "active").trim();
    const managedByPm = formData.get("managedByPm") === "on";
    const notesRaw = (formData.get("notes")?.toString() || "").trim();
    const tenantIds = formData.getAll("tenantIds").map((v) => v.toString());

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
          status,
          managedByPm,
          notes: notesRaw.length ? notesRaw : null,
        },
      });

      // Replace tenant links
      await tx.leaseTenant.deleteMany({ where: { leaseId } });

      if (tenantIds.length) {
        await tx.leaseTenant.createMany({
          data: tenantIds.map((tenantId, idx) => ({
            leaseId,
            tenantId,
            role: idx === 0 ? "primary" : "additional",
          })),
          skipDuplicates: true,
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
