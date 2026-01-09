import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { LeaseStatus } from "@prisma/client";
import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import RowActions from "@/components/ui/RowActions";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function moneyColor(n: number) {
  if (n < 0) return "var(--danger, #ff6b6b)";
  if (n > 0) return "var(--success, #5dd3a6)";
  return undefined;
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function statusBadge(status: LeaseStatus) {
  const base: React.CSSProperties = {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 12,
    fontWeight: 800,
    letterSpacing: 0.3,
    border: "1px solid rgba(255,255,255,0.16)",
    background: "rgba(255,255,255,0.06)",
  };

  if (status === "active") return { ...base };
  if (status === "upcoming")
    return { ...base, borderColor: "rgba(120,180,255,0.35)" };
  // ended
  return { ...base, opacity: 0.7 };
}

function statusOrder(status: LeaseStatus) {
  // Active first, then upcoming, then ended
  if (status === "active") return 0;
  if (status === "upcoming") return 1;
  return 2;
}

export default async function PropertyLeasesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const property = await prisma.property.findUnique({
    where: { id },
  });
  if (!property) notFound();

  const leasesRaw = await prisma.lease.findMany({
    where: { propertyId: id },
    orderBy: [{ startDate: "desc" }],
    include: {
      leaseTenants: { include: { tenant: true } },
    },
  });

  // Sort: active, upcoming, ended. Within each, newest start date first.
  const leases = [...leasesRaw].sort((a, b) => {
    const ao = statusOrder(a.status);
    const bo = statusOrder(b.status);
    if (ao !== bo) return ao - bo;
    return b.startDate.getTime() - a.startDate.getTime();
  });

  const title =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Leases · {title}</div>
            <div style={{ opacity: 0.85, marginTop: 2, fontSize: 13 }}>
              {leases.length} total
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Back
            </Link>
            <Link className="ll_btn" href={`/properties/${property.id}/leases/new`}>
              New lease
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {leases.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {leases.map((l) => {
                const tenants = l.leaseTenants
                  .map((lt) => `${lt.tenant.lastName}, ${lt.tenant.firstName}`)
                  .join(", ");

                const isEnded = l.status === "ended";

                return (
                  <div
                    key={l.id}
                    style={{
                      padding: "12px 0",
                      borderBottom: "1px solid rgba(255,255,255,0.10)",
                      opacity: isEnded ? 0.6 : 0.92,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: 10,
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <span style={statusBadge(l.status)}>{l.status.toUpperCase()}</span>
                        {l.unitLabel ? <span className="ll_pill">{l.unitLabel}</span> : null}
                        <div style={{ fontWeight: 800 }}>
                          {fmtDate(l.startDate)} → {fmtDate(l.endDate)}
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <RowActions
                          editHref={`/properties/${property.id}/leases/${l.id}/edit`}
                          ariaLabelEdit={`Edit lease ${fmtDate(l.startDate)} to ${fmtDate(l.endDate)}`}
                        />

                        {!isEnded ? (
                          <form
                            action={`/api/properties/${property.id}/leases/${l.id}`}
                            method="post"
                            style={{ margin: 0 }}
                          >
                            <input type="hidden" name="_action" value="end" />
                          <ConfirmSubmitButton
                            className="ll_btnSecondary"
                            message="End this lease now? You can still edit it later."
                          >
                            End
                          </ConfirmSubmitButton>

                          </form>
                        ) : null}
                      </div>
                    </div>

                    <div style={{ opacity: 0.85, marginTop: 6 }}>
                      Rent
                      <span style={{ color: moneyColor(l.rentAmount) || "inherit" }}>
                        {" "}
                        {money(l.rentAmount)}
                      </span>
                      {" "}· Due day {l.dueDay} · Deposit{" "}
                      {l.deposit === null || l.deposit === undefined ? (
                        "—"
                      ) : (
                        <span style={{ color: moneyColor(l.deposit) || "inherit" }}>
                          {money(l.deposit)}
                        </span>
                      )}
                    </div>

                    <div style={{ opacity: 0.8, marginTop: 4 }}>
                      Tenants: {tenants || "n/a"}
                    </div>

                    <div style={{ opacity: 0.75, marginTop: 4, fontSize: 12 }}>
                      Managed by PM: {l.managedByPm ? "Yes" : "No"}
                      {l.notes ? ` · Notes: ${l.notes}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No leases yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
