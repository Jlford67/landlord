import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function money(n?: number | null) {
  if (n === null || n === undefined) return "—";

  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return n < 0 ? `(${abs})` : `$${abs}`;
}

function moneyParts(n?: number | null) {
  if (n === null || n === undefined) return { text: "—", isNegative: false };

  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return n < 0 ? { text: `(${abs})`, isNegative: true } : { text: `$${abs}`, isNegative: false };
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const user = await requireUser();

  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      leases: {
        orderBy: [{ startDate: "desc" }],
        take: 5,
        include: { leaseTenants: { include: { tenant: true } } },
      },
      transactions: {
        orderBy: [{ date: "desc" }],
        take: 10,
        include: { category: true },
      },
      pmAssignments: {
        orderBy: [{ startDate: "desc" }],
        take: 3,
        include: { pm: true },
      },
      loans: { orderBy: [{ origDate: "desc" }], take: 3 },
      taxAccounts: { orderBy: [{ dueDate: "desc" }], take: 3 },
      insurance: { orderBy: [{ dueDate: "desc" }], take: 3 },
      ownerships: { include: { entity: true } },
    },
  });

  if (!property) notFound();

  const title =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  const activeLease = property.leases.find((l) => l.status === "active");

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{title}</div>
            <div style={{ opacity: 0.85, marginTop: 2, fontSize: 13 }}>
              Signed in as {user.email}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href="/properties">
              Back
            </Link>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}/edit`}>
              Edit
            </Link>
            <form action="/api/auth/logout" method="post">
              <button className="ll_btnSecondary" type="submit">
                Logout
              </button>
            </form>
          </div>
        </div>

        {/* Summary */}
        <div style={{ marginTop: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Summary</div>
          <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
            <div>
              Address: {property.street}, {property.city}, {property.state} {property.zip}
            </div>
            <div>Status: {property.status}</div>
            <div>
              Doors: {property.doors ?? "—"} | Beds: {property.beds ?? "—"} | Baths:{" "}
              {property.baths ?? "—"} | Sq Ft: {property.sqFt ?? "—"}
            </div>
            <div>Notes: {property.notes ?? "—"}</div>
          </div>
        </div>

        {/* Ownership */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Ownership</div>
          {property.ownerships.length ? (
            <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
              {property.ownerships.map((o) => (
                <div key={o.id}>
                  {o.entity.name} ({o.entity.type}) – {o.ownershipPct}%
                  {o.startDate ? ` since ${fmtDate(o.startDate)}` : ""}
                  {o.endDate ? ` (ended ${fmtDate(o.endDate)})` : ""}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No ownership records yet.</div>
          )}
        </div>

        {/* Lease */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <div style={{ fontWeight: 700 }}>Leases</div>

            <Link className="ll_btnSecondary" href={`/properties/${property.id}/leases`}>
              View all
            </Link>
          </div>

          {activeLease ? (
            <div style={{ marginTop: 10, opacity: 0.9, lineHeight: 1.6 }}>
              <div>
                Active lease: {fmtDate(activeLease.startDate)} →{" "}
                {activeLease.endDate ? fmtDate(activeLease.endDate) : "open-ended"} (due day{" "}
                {activeLease.dueDay})
              </div>
              <div>
                Rent: {money(activeLease.rentAmount)} | Deposit: {money(activeLease.deposit)}
              </div>
              <div>Managed by PM: {activeLease.managedByPm ? "Yes" : "No"}</div>
              <div>
                Tenants:{" "}
                {activeLease.leaseTenants.length
                  ? activeLease.leaseTenants
                      .map((lt) => `${lt.tenant.firstName} ${lt.tenant.lastName}`)
                      .join(", ")
                  : "—"}
              </div>
            </div>
          ) : (
            <div style={{ marginTop: 10, opacity: 0.75 }}>No active lease found.</div>
          )}

          {property.leases.length ? (
            <div style={{ marginTop: 10, opacity: 0.85 }}>
              <div style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>Recent leases</div>
              <div style={{ display: "grid", gap: 6 }}>
                {property.leases.map((l) => (
                  <div key={l.id} style={{ opacity: 0.9 }}>
                    {l.status.toUpperCase()} · {fmtDate(l.startDate)} →{" "}
                    {l.endDate ? fmtDate(l.endDate) : "—"} · {money(l.rentAmount)}
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {/* Property Manager */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Property manager</div>
          {property.pmAssignments.length ? (
            <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
              {property.pmAssignments.map((a) => (
                <div key={a.id}>
                  {a.pm.companyName}
                  {a.pm.contactName ? ` (${a.pm.contactName})` : ""} ·{" "}
                  {a.startDate ? fmtDate(a.startDate) : "—"} →{" "}
                  {a.endDate ? fmtDate(a.endDate) : "present"} ·{" "}
                  {a.feeType ? `${a.feeType} ${a.feeValue ?? ""}` : "fee —"}
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No property manager assignment yet.</div>
          )}
        </div>

        {/* Money (Recent transactions) */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 10,
            }}
          >
            <div style={{ fontWeight: 700 }}>Recent transactions</div>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}/ledger`}>
              View all
            </Link>
          </div>

          <div className="ll_list ll_txnList">
            <div className="ll_listHeader">
              <div>Date</div>
              <div>Category</div>
              <div>Amount</div>
            </div>

            <div className="ll_listBody">
              {property.transactions.length ? (
                property.transactions.map((t) => (
                  <div key={t.id} className="ll_listRow">
                    <div style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</div>
                    <div style={{ minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {t.category ? (
                        <>
                          <span className="ll_muted">{t.category.type.toUpperCase()}</span>{" "}
                          {" - "}
                          {t.category.name}
                        </>
                      ) : (
                        <span className="ll_muted">(no category)</span>
                      )}
                    </div>
                    {(() => {
                    const m = moneyParts(t.amount);
                    return (
                      <div
                        style={{
                          whiteSpace: "nowrap",
                          color: m.isNegative ? "var(--danger, #ff6b6b)" : "inherit",
                          fontWeight: 700,
                        }}
                      >
                        {m.text}
                      </div>
                    );
                  })()}

                  </div>
                ))
              ) : (
                <div className="ll_listRow">
                  <div className="ll_muted">(none)</div>
                  <div />
                  <div />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loans / Tax / Insurance */}
        <div
          style={{
            marginTop: 18,
            paddingTop: 14,
            borderTop: "1px solid rgba(255,255,255,0.12)",
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Accounts</div>

          <div style={{ display: "grid", gap: 14 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Loans</div>
              {property.loans.length ? (
                <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
                  {property.loans.map((l) => (
                    <div key={l.id}>
                      {l.lenderName ?? "—"} · Rate {l.ratePct ?? "—"}% · Term {l.termYears ?? "—"}{" "}
                      yrs · Orig {money(l.origAmount)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No loans yet.</div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Property tax</div>
              {property.taxAccounts.length ? (
                <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
                  {property.taxAccounts.map((t) => (
                    <div key={t.id}>
                      Annual {money(t.annualAmount)} · Due {fmtDate(t.dueDate)} · Last paid{" "}
                      {fmtDate(t.lastPaid)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No tax accounts yet.</div>
              )}
            </div>

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>Insurance</div>
              {property.insurance.length ? (
                <div style={{ opacity: 0.9, lineHeight: 1.6 }}>
                  {property.insurance.map((i) => (
                    <div key={i.id}>
                      {i.insurer ?? "—"} · Premium {money(i.premium)} · Due {fmtDate(i.dueDate)} ·
                      Paid {fmtDate(i.paidDate)}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ opacity: 0.75 }}>No insurance policies yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
