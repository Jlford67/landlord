import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import TenantPicker, { TenantLite } from "@/components/TenantPicker";
import AddTenantButton from "@/components/AddTenantButton";

type Params = { id: string; leaseId: string };
type SearchParams = Record<string, string | string[] | undefined>;

function toDateInputValue(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

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

export default async function EditLeasePage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const { id: propertyId, leaseId } = await params;
  const sp = searchParams ? await searchParams : {};

  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) notFound();

  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: { leaseTenants: { include: { tenant: true } } },
  });
  if (!lease || lease.propertyId !== propertyId) notFound();

  // Defaults from query string (used when returning from Add Tenant),
  // otherwise fall back to current lease values.
  const startDateQ = getStr(sp, "startDate");
  const endDateQ = getStr(sp, "endDate");
  const unitLabelQ = getStr(sp, "unitLabel");
  const rentAmountQ = getStr(sp, "rentAmount");
  const dueDayQ = getStr(sp, "dueDay");
  const depositQ = getStr(sp, "deposit");
  const statusQ = getStr(sp, "status");
  const managedByPmQ = getStr(sp, "managedByPm"); // "1" or "0"
  const notesQ = getStr(sp, "notes");

  const defaultStartDate = startDateQ || toDateInputValue(lease.startDate);
  const defaultEndDate = endDateQ || (lease.endDate ? toDateInputValue(lease.endDate) : "");
  const defaultUnitLabel = unitLabelQ || lease.unitLabel || "";
  const defaultRentAmount = rentAmountQ || String(lease.rentAmount);
  const defaultDueDay = dueDayQ || String(lease.dueDay);
  const defaultDeposit =
    depositQ || (lease.deposit === null || lease.deposit === undefined ? "" : String(lease.deposit));
  const defaultStatus = statusQ || lease.status;
  const defaultManagedByPm = managedByPmQ
    ? managedByPmQ === "1"
    : lease.managedByPm;
  const defaultNotes = notesQ || (lease.notes ?? "");

  // Preserve selected tenants across Add Tenant
  const tenantIdsFromQuery = getStrArray(sp, "tenantIds");

  let initialSelectedTenants: TenantLite[] = [];
  if (tenantIdsFromQuery.length) {
    const rows = await prisma.tenant.findMany({
      where: { id: { in: tenantIdsFromQuery } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    // Keep same order as query params when possible
    const map = new Map(rows.map((t) => [t.id, t]));
    initialSelectedTenants = tenantIdsFromQuery
      .map((id) => map.get(id))
      .filter(Boolean)
      .map((t) => ({
        id: t!.id,
        firstName: t!.firstName,
        lastName: t!.lastName,
        email: t!.email ?? null,
      }));
  } else {
    initialSelectedTenants = lease.leaseTenants.map((lt) => ({
      id: lt.tenant.id,
      firstName: lt.tenant.firstName,
      lastName: lt.tenant.lastName,
      email: lt.tenant.email ?? null,
    }));
  }

  const title =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  const returnToBasePath = `/properties/${propertyId}/leases/${leaseId}/edit`;

  return (
    <div className="ll_page" suppressHydrationWarning>
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Edit lease</div>
            <div style={{ opacity: 0.85, marginTop: 2, fontSize: 13 }}>{title}</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${propertyId}/leases`}>
              Back
            </Link>
          </div>
        </div>

        <form
          id="leaseForm"
          className="ll_form"
          action={`/api/properties/${propertyId}/leases/${leaseId}`}
          method="post"
          autoComplete="off"
        >
          <input type="hidden" name="_action" value="update" />

          <label>
            Start date
            <input className="ll_input" type="date" name="startDate" defaultValue={defaultStartDate} required />
          </label>

          <label>
            End date (optional)
            <input className="ll_input" type="date" name="endDate" defaultValue={defaultEndDate} />
          </label>

          <label>
            Unit / Room (optional)
            <input
              className="ll_input"
              type="text"
              name="unitLabel"
              defaultValue={defaultUnitLabel}
              placeholder="Unit A"
            />
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
              defaultValue={Number(defaultDueDay)}
              required
            />
          </label>

          <label>
            Deposit (optional)
            <input className="ll_input" type="number" step="0.01" name="deposit" defaultValue={defaultDeposit} />
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
              Save changes
            </button>

            <Link className="ll_btnSecondary" href={`/properties/${propertyId}/leases`}>
              Cancel
            </Link>
          </div>
        </form>

        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>End lease</div>
          <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 10 }}>
            Marks the lease as ended. You can set an end date (defaults to today).
          </div>

          <form className="ll_form" action={`/api/properties/${propertyId}/leases/${leaseId}`} method="post">
            <input type="hidden" name="_action" value="end" />
            <label>
              End date
              <input className="ll_input" type="date" name="endDate" defaultValue="" />
            </label>

            <button className="ll_btnSecondary" type="submit">
              End lease
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
