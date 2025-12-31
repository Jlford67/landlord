import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AddTenantButton from "@/components/AddTenantButton";
import TenantPicker, { TenantLite } from "@/components/TenantPicker";
import NewLeaseForm from "@/components/leases/NewLeaseForm";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function getStrArray(sp: SearchParams, key: string): string[] {
  const v = sp[key];
  if (typeof v === "string") return v ? [v] : [];
  if (Array.isArray(v)) return v.filter(Boolean) as string[];
  return [];
}

export default async function NewLeasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const { id } = await params;
  const sp = searchParams ? await searchParams : {};

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  // Defaults from query string (used when returning from Add Tenant)
  const defaultStartDate = getStr(sp, "startDate");
  const defaultEndDate = getStr(sp, "endDate");
  const defaultRentAmount = getStr(sp, "rentAmount");
  const defaultDueDay = getStr(sp, "dueDay") || "1";
  const defaultDeposit = getStr(sp, "deposit");
  const defaultStatus = getStr(sp, "status") || "active";
  const managedByPmParam = getStr(sp, "managedByPm"); // "1" or "0" or empty
  const defaultManagedByPm = managedByPmParam === "0" ? false : true;
  const defaultNotes = getStr(sp, "notes");

  // Preserve selected tenantIds across "Add tenant"
  const tenantIdsFromQuery = getStrArray(sp, "tenantIds");

  const initialSelectedTenantsRaw = tenantIdsFromQuery.length
    ? await prisma.tenant.findMany({
        where: { id: { in: tenantIdsFromQuery } },
        select: { id: true, firstName: true, lastName: true, email: true },
      })
    : [];

  const initialSelectedTenants: TenantLite[] = initialSelectedTenantsRaw.map((t) => ({
    id: t.id,
    firstName: t.firstName,
    lastName: t.lastName,
    email: t.email ?? null,
  }));

  const propertyTitle =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  const returnToBasePath = `/properties/${property.id}/leases/new`;

  return (
    <div className="ll_page" suppressHydrationWarning>
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>New lease</div>
            <div style={{ opacity: 0.85, marginTop: 2, fontSize: 13 }}>
              {propertyTitle}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${property.id}/leases`}>
              Back
            </Link>
          </div>
        </div>

        <NewLeaseForm
          propertyId={property.id}
          backHref={`/properties/${property.id}/leases`}
          actionHref={`/api/properties/${property.id}/leases`}
          defaultStartDate={defaultStartDate}
          defaultEndDate={defaultEndDate}
          defaultRentAmount={defaultRentAmount}
          defaultDueDay={Number(defaultDueDay || 1)}
          defaultDeposit={defaultDeposit}
          defaultStatus={defaultStatus}
          defaultManagedByPm={defaultManagedByPm}
          defaultNotes={defaultNotes}
          returnToBasePath={returnToBasePath}
          initialSelectedTenants={initialSelectedTenants}
        />

      </div>
    </div>
  );
}
