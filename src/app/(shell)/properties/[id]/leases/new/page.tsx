import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import AddTenantButton from "@/components/AddTenantButton";
import TenantPicker, { TenantLite } from "@/components/TenantPicker";

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

        <form
          id="leaseForm"
          className="ll_form"
          action={`/api/properties/${property.id}/leases`}
          method="post"
          autoComplete="off"
        >
          <label>
            Start date
            <input
              className="ll_input"
              type="date"
              name="startDate"
              defaultValue={defaultStartDate}
              required
            />
          </label>

          <label>
            End date (optional)
            <input className="ll_input" type="date" name="endDate" defaultValue={defaultEndDate} />
          </label>

          <label>
            Rent amount
            <input
              className="ll_input"
              type="number"
              step="0.01"
              name="rentAmount"
              defaultValue={defaultRentAmount}
              required
            />
          </label>

          <label>
            Due day (1-28)
            <input
              className="ll_input"
              type="number"
              min={1}
              max={28}
              name="dueDay"
              defaultValue={Number(defaultDueDay || 1)}
              required
            />
          </label>

          <label>
            Deposit (optional)
            <input
              className="ll_input"
              type="number"
              step="0.01"
              name="deposit"
              defaultValue={defaultDeposit}
            />
          </label>

          <label>
            Status
            <select className="ll_input" name="status" defaultValue={defaultStatus}>
              <option value="upcoming">upcoming</option>
              <option value="active">active</option>
              <option value="ended">ended</option>
            </select>
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input type="checkbox" name="managedByPm" defaultChecked={defaultManagedByPm} />
            Managed by PM
          </label>

          <label>
            Notes (optional)
            <input className="ll_input" name="notes" defaultValue={defaultNotes} />
          </label>

          <div style={{ marginTop: 6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 700 }}>Tenants</div>

              <AddTenantButton
                tenantsNewBaseHref="/tenants/new?returnTo="
                returnToBasePath={returnToBasePath}
                formId="leaseForm"
              />
            </div>

            <TenantPicker initialSelected={initialSelectedTenants} />
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="ll_btn" type="submit">
              Create lease
            </button>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}/leases`}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
