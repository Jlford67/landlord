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
  ctx: { params: { id: string } } | { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Next 16: params may be a Promise
    const paramsMaybePromise = (ctx as any).params;
    const unwrappedParams =
      typeof paramsMaybePromise?.then === "function"
        ? await paramsMaybePromise
        : paramsMaybePromise;

    const propertyId: string | undefined = unwrappedParams?.id;
    if (!propertyId) {
      return NextResponse.json({ error: "Missing property id" }, { status: 400 });
    }

    const formData = await req.formData();

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
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
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
      const prop = await tx.property.findUnique({ where: { id: propertyId } });
      if (!prop) throw new Error(`Property not found: ${propertyId}`);

      const created = await tx.lease.create({
        data: {
          propertyId, // IMPORTANT: use unwrapped propertyId
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

      if (tenantIds.length) {
        await tx.leaseTenant.createMany({
          data: tenantIds.map((tenantId, idx) => ({
            leaseId: created.id,
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
      { error: "Lease create failed", detail: err?.message || String(err) },
      { status: 500 }
    );
  }
}
