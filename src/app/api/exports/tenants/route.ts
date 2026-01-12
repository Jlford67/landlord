import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import type { LeaseStatus } from "@prisma/client";

export const runtime = "nodejs";

type LeaseWithProperty = {
  id: string;
  propertyId: string;
  startDate: Date;
  endDate: Date | null;
  rentAmount: number;
  dueDay: number;
  deposit: number | null;
  unitLabel: string | null;
  status: LeaseStatus;
  managedByPm: boolean;
  notes: string | null;
  createdAt: Date;
  property: {
    id: string;
    nickname: string | null;
    street: string;
    city: string;
    state: string;
    zip: string;
  };
};

function propertyDisplayName(property: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return property.nickname?.trim() || `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
}

function selectCurrentLease(leases: LeaseWithProperty[]): LeaseWithProperty | null {
  if (!leases.length) return null;
  const statusRank: Record<LeaseStatus, number> = { active: 0, upcoming: 1, ended: 2 };
  return [...leases]
    .sort((a, b) => {
      const statusDiff = statusRank[a.status] - statusRank[b.status];
      if (statusDiff !== 0) return statusDiff;
      return b.startDate.getTime() - a.startDate.getTime();
    })
    .at(0) ?? null;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const tenants = await prisma.tenant.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      notes: true,
      createdAt: true,
      leaseTenants: {
        select: {
          id: true,
          role: true,
          lease: {
            select: {
              id: true,
              propertyId: true,
              startDate: true,
              endDate: true,
              rentAmount: true,
              dueDay: true,
              deposit: true,
              unitLabel: true,
              status: true,
              managedByPm: true,
              notes: true,
              createdAt: true,
              property: {
                select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
              },
            },
          },
        },
        orderBy: [{ lease: { startDate: "desc" } }],
      },
    },
  });

  const tenantSheet: ExcelSheet = {
    name: "Tenants",
    columns: [
      { key: "tenantId", header: "Tenant ID", type: "id", width: 20 },
      { key: "firstName", header: "First Name", type: "text", width: 16 },
      { key: "lastName", header: "Last Name", type: "text", width: 16 },
      { key: "email", header: "Email", type: "text", width: 24 },
      { key: "phone", header: "Phone", type: "text", width: 16 },
      { key: "notes", header: "Notes", type: "notes", width: 50 },
      { key: "createdAt", header: "Created At", type: "date", width: 12 },
      { key: "leaseId", header: "Current Lease ID", type: "id", width: 20 },
      { key: "leaseStatus", header: "Lease Status", type: "text", width: 12 },
      { key: "leaseStart", header: "Lease Start Date", type: "date", width: 12 },
      { key: "leaseEnd", header: "Lease End Date", type: "date", width: 12 },
      { key: "rentAmount", header: "Rent Amount", type: "currency", width: 14 },
      { key: "dueDay", header: "Due Day", type: "number", width: 10 },
      { key: "deposit", header: "Deposit", type: "currency", width: 14 },
      { key: "unitLabel", header: "Unit Label", type: "text", width: 14 },
      { key: "managedByPm", header: "Managed By PM", type: "text", width: 14 },
      { key: "leaseNotes", header: "Lease Notes", type: "notes", width: 50 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 30 },
      { key: "propertyStreet", header: "Property Street", type: "text", width: 28 },
      { key: "propertyCity", header: "Property City", type: "text", width: 16 },
      { key: "propertyState", header: "Property State", type: "text", width: 10 },
      { key: "propertyZip", header: "Property ZIP", type: "text", width: 12 },
    ],
    rows: tenants.map((tenant) => {
      const leases = tenant.leaseTenants.map((lt) => lt.lease) as LeaseWithProperty[];
      const currentLease = selectCurrentLease(leases);

      return {
        tenantId: tenant.id,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
        email: tenant.email ?? "",
        phone: tenant.phone ?? "",
        notes: tenant.notes ?? "",
        createdAt: tenant.createdAt,
        leaseId: currentLease?.id ?? "",
        leaseStatus: currentLease?.status ?? "",
        leaseStart: currentLease?.startDate ?? null,
        leaseEnd: currentLease?.endDate ?? null,
        rentAmount: currentLease?.rentAmount ?? null,
        dueDay: currentLease?.dueDay ?? null,
        deposit: currentLease?.deposit ?? null,
        unitLabel: currentLease?.unitLabel ?? "",
        managedByPm: currentLease ? (currentLease.managedByPm ? "Yes" : "No") : "",
        leaseNotes: currentLease?.notes ?? "",
        propertyId: currentLease?.propertyId ?? "",
        propertyName: currentLease ? propertyDisplayName(currentLease.property) : "",
        propertyStreet: currentLease?.property.street ?? "",
        propertyCity: currentLease?.property.city ?? "",
        propertyState: currentLease?.property.state ?? "",
        propertyZip: currentLease?.property.zip ?? "",
      };
    }),
  };

  const leaseSheet: ExcelSheet = {
    name: "Leases",
    columns: [
      { key: "leaseTenantId", header: "Lease Tenant ID", type: "id", width: 20 },
      { key: "tenantId", header: "Tenant ID", type: "id", width: 20 },
      { key: "tenantName", header: "Tenant Name", type: "text", width: 22 },
      { key: "role", header: "Role", type: "text", width: 12 },
      { key: "leaseId", header: "Lease ID", type: "id", width: 20 },
      { key: "leaseStatus", header: "Lease Status", type: "text", width: 12 },
      { key: "leaseStart", header: "Lease Start Date", type: "date", width: 12 },
      { key: "leaseEnd", header: "Lease End Date", type: "date", width: 12 },
      { key: "rentAmount", header: "Rent Amount", type: "currency", width: 14 },
      { key: "dueDay", header: "Due Day", type: "number", width: 10 },
      { key: "deposit", header: "Deposit", type: "currency", width: 14 },
      { key: "unitLabel", header: "Unit Label", type: "text", width: 14 },
      { key: "managedByPm", header: "Managed By PM", type: "text", width: 14 },
      { key: "leaseNotes", header: "Lease Notes", type: "notes", width: 50 },
      { key: "leaseCreatedAt", header: "Lease Created At", type: "date", width: 12 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 30 },
      { key: "propertyStreet", header: "Property Street", type: "text", width: 28 },
      { key: "propertyCity", header: "Property City", type: "text", width: 16 },
      { key: "propertyState", header: "Property State", type: "text", width: 10 },
      { key: "propertyZip", header: "Property ZIP", type: "text", width: 12 },
    ],
    rows: tenants.flatMap((tenant) =>
      tenant.leaseTenants.map((leaseTenant) => ({
        leaseTenantId: leaseTenant.id,
        tenantId: tenant.id,
        tenantName: `${tenant.lastName}, ${tenant.firstName}`,
        role: leaseTenant.role ?? "",
        leaseId: leaseTenant.lease.id,
        leaseStatus: leaseTenant.lease.status,
        leaseStart: leaseTenant.lease.startDate,
        leaseEnd: leaseTenant.lease.endDate,
        rentAmount: leaseTenant.lease.rentAmount,
        dueDay: leaseTenant.lease.dueDay,
        deposit: leaseTenant.lease.deposit ?? null,
        unitLabel: leaseTenant.lease.unitLabel ?? "",
        managedByPm: leaseTenant.lease.managedByPm ? "Yes" : "No",
        leaseNotes: leaseTenant.lease.notes ?? "",
        leaseCreatedAt: leaseTenant.lease.createdAt,
        propertyId: leaseTenant.lease.propertyId,
        propertyName: propertyDisplayName(leaseTenant.lease.property),
        propertyStreet: leaseTenant.lease.property.street,
        propertyCity: leaseTenant.lease.property.city,
        propertyState: leaseTenant.lease.property.state,
        propertyZip: leaseTenant.lease.property.zip,
      })),
    ),
  };

  const buffer = buildWorkbookBuffer([tenantSheet, leaseSheet]);
  const filename = `tenants-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
