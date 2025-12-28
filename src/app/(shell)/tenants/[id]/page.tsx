import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function money(n: number) {
  return n.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
}

function moneyColor(n: number) {
  if (n < 0) return "var(--danger, #ff6b6b)";
  if (n > 0) return "var(--success, #5dd3a6)";
  return undefined;
}

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const tenant = await prisma.tenant.findUnique({ where: { id } });
  if (!tenant) notFound();

  const leaseLinks = await prisma.leaseTenant.findMany({
    where: { tenantId: id },
    include: {
      lease: {
        include: {
          property: true,
        },
      },
    },
    orderBy: [{ lease: { startDate: "desc" } }],
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div style={{ fontSize: 18, fontWeight: 700 }}>
          {tenant.lastName}, {tenant.firstName}
        </div>

        <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>
          {tenant.email || "—"} {tenant.phone ? ` · ${tenant.phone}` : ""}
        </div>

        {/* Edit tenant */}
        <div style={{ marginTop: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>Edit tenant</div>

          <form
            className="ll_form"
            action={`/api/tenants/${tenant.id}`}
            method="post"
            autoComplete="off"
          >
            <label>
              First name
              <input
                className="ll_input"
                name="firstName"
                defaultValue={tenant.firstName}
                required
              />
            </label>

            <label>
              Last name
              <input
                className="ll_input"
                name="lastName"
                defaultValue={tenant.lastName}
                required
              />
            </label>

            <label>
              Email (optional)
              <input
                className="ll_input"
                name="email"
                defaultValue={tenant.email ?? ""}
                suppressHydrationWarning
              />
            </label>

            <label>
              Phone (optional)
              <input
                className="ll_input"
                name="phone"
                defaultValue={tenant.phone ?? ""}
                suppressHydrationWarning
              />
            </label>

            <label>
              Notes (optional)
              <input
                className="ll_input"
                name="notes"
                defaultValue={tenant.notes ?? ""}
              />
            </label>

            <button
              className="ll_btn"
              type="submit"
              suppressHydrationWarning
            >
              Save tenant
            </button>
          </form>
        </div>

        {/* Lease history */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            Lease history
          </div>

          {leaseLinks.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {leaseLinks.map((lt) => {
                const l = lt.lease;
                const p = l.property;
                const propTitle =
                  p.nickname?.trim() ||
                  `${p.street}, ${p.city}, ${p.state} ${p.zip}`;

                return (
                  <div
                    key={lt.id}
                    style={{
                      border: "1px solid rgba(255,255,255,0.10)",
                      borderRadius: 12,
                      padding: "10px 12px",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>{propTitle}</div>

                    <div style={{ opacity: 0.85, marginTop: 4 }}>
                      {l.status.toUpperCase()} · {fmtDate(l.startDate)} →{" "}
                      {fmtDate(l.endDate)}
                    </div>

                    <div
                      style={{
                        opacity: 0.8,
                        marginTop: 4,
                        fontSize: 13,
                      }}
                    >
                      Rent
                      <span style={{ color: moneyColor(l.rentAmount) || "inherit" }}>
                        {" "}
                        {money(l.rentAmount)}
                      </span>
                      {" "}· Due day {l.dueDay}
                    </div>

                    <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
                      <Link
                        className="ll_btnSecondary"
                        href={`/properties/${p.id}/leases`}
                      >
                        View property leases
                      </Link>
                      <Link
                        className="ll_btnSecondary"
                        href={`/properties/${p.id}/leases/${l.id}/edit`}
                      >
                        Edit lease
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>
              No leases found for this tenant.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
