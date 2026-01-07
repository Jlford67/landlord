import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import ZillowLogo from "@/components/logos/ZillowLogo";
import RedfinLogo from "@/components/logos/RedfinLogo";
import PropertyThumb from "@/components/properties/PropertyThumb";

const moneyFmt = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmtUtc = new Intl.DateTimeFormat("en-US", { timeZone: "UTC" });

function fmtDate(d?: Date | null) {
  if (!d) return "n/a";
  return dateFmtUtc.format(d);
}

function formatIsoDate(value?: Date | null) {
  if (!value) return null;
  return value.toISOString().slice(0, 10);
}

function formatWholeNumber(value: number) {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatEstimate(value?: number | null) {
  if (value === null || value === undefined) return "Not set";
  return formatWholeNumber(value);
}

function formatPurchasePrice(cents?: number | null) {
  if (cents === null || cents === undefined) return "Not set";
  const dollars = cents / 100;
  const abs = moneyFmt.format(Math.abs(dollars));
  return dollars < 0 ? `(${abs})` : `$${abs}`;
}

function moneyText(n?: number | null) {
  if (n === null || n === undefined) return "n/a";
  const abs = moneyFmt.format(Math.abs(n));
  return n < 0 ? `(${abs})` : `$${abs}`;
}

function moneyClass(n?: number | null) {
  if (n === null || n === undefined) return "";
  if (n < 0) return "ll_neg";
  if (n > 0) return "ll_pos";
  return "";
}

function Money({ value }: { value?: number | null }) {
  return <span className={moneyClass(value)}>{moneyText(value)}</span>;
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
      insurance: { orderBy: [{ dueDate: "desc" }], take: 5 },
      ownerships: { include: { entity: true } },
    },
  });

  if (!property) notFound();

  const title =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  const activeLease = property.leases.find((l) => l.status === "active");
  const annualYear = new Date().getUTCFullYear();

  return (
    <div className="ll_page" suppressHydrationWarning>
      {/* HERO */}
      <div className="ll_card">
        <div className="flex items-start gap-4">
          <PropertyThumb propertyId={property.id} />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-lg font-semibold text-gray-900 truncate">{title}</div>
              {property.status && property.status !== "active" ? <span className="ll_pill">{property.status}</span> : null}
            </div>

            <div className="ll_muted mt-1">
              {property.street}, {property.city}, {property.state} {property.zip}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link className="ll_btn" href="/properties">
                Back
              </Link>

              <Link className="ll_btn ll_btnLink" href={`/properties/${property.id}/edit`}>
                Edit
              </Link>

              <Link className="ll_btn ll_btnPrimary" href={`/properties/${property.id}/leases/new`}>
                New lease
              </Link>

              <form action="/api/auth/logout" method="post">
                <button
                  className="ll_btn"
                  type="submit"
                  suppressHydrationWarning
                >
                  Logout
                </button>
              </form>

            </div>
          </div>
        </div>
      </div>

      {/* GRID */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* SUMMARY */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Summary</div>
            <div className="ll_spacer" />
            <Link className="ll_btn ll_btnLink" href={`/properties/${property.id}/ledger`}>
              Ledger
            </Link>
          </div>

          <div className="mt-3 space-y-1 text-sm text-gray-700">
            <div>
              <span className="ll_label">Address:</span>{" "}
              <span className="text-gray-700">
                {property.street}, {property.city}, {property.state} {property.zip}
              </span>
            </div>

            <div>
              <span className="ll_label">Doors:</span> {property.doors ?? "n/a"}{" "}
              <span className="ll_label">Beds:</span> {property.beds ?? "n/a"}{" "}
              <span className="ll_label">Baths:</span> {property.baths ?? "n/a"}{" "}
              <span className="ll_label">Sq Ft:</span> {property.sqFt ?? "n/a"}
            </div>

            <div>
              <span className="ll_label">Notes:</span> {property.notes ?? "n/a"}
            </div>
          </div>
        </div>

        {/* ESTIMATED VALUE */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Estimated value</div>
            <div className="ll_spacer" />
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                {property.zillowUrl ? (
                  <a
                    href={property.zillowUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 font-semibold text-[#006aff] hover:underline"
                  >
                    <ZillowLogo className="h-6 w-auto" />
                  </a>
                ) : (
                  <ZillowLogo className="h-6 w-auto" />
                )}
                <div className="ll_spacer" />
                {property.zillowUrl ? (
                  <a
                    href={property.zillowUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:underline"
                  >
                    View
                  </a>
                ) : null}
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {formatEstimate(property.zillowEstimatedValue)}
              </div>
              {property.zillowEstimatedValueUpdatedAt ? (
                <div className="mt-1 text-xs text-gray-500">
                  Updated: {formatIsoDate(property.zillowEstimatedValueUpdatedAt)}
                </div>
              ) : null}
            </div>

            <div className="rounded border border-gray-200 p-3">
              <div className="flex items-center gap-2">
                {property.redfinUrl ? (
                  <a
                    href={property.redfinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 font-semibold text-[#a61c30] hover:underline"
                  >
                    <RedfinLogo className="h-6 w-auto" />
                  </a>
                ) : (
                  <RedfinLogo className="h-6 w-auto" />
                )}
                <div className="ll_spacer" />
                {property.redfinUrl ? (
                  <a
                    href={property.redfinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-gray-500 hover:underline"
                  >
                    View
                  </a>
                ) : null}
              </div>
              <div className="mt-2 text-lg font-semibold text-gray-900">
                {formatEstimate(property.redfinEstimatedValue)}
              </div>
              {property.redfinEstimatedValueUpdatedAt ? (
                <div className="mt-1 text-xs text-gray-500">
                  Updated: {formatIsoDate(property.redfinEstimatedValueUpdatedAt)}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 border-t border-gray-200 pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="ll_label">Purchase price</span>
              <span className={property.purchasePriceCents ? "font-semibold text-gray-900" : "ll_muted"}>
                {formatPurchasePrice(property.purchasePriceCents)}
              </span>
            </div>
          </div>
        </div>

        {/* OWNERSHIP */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Ownership</div>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            {property.ownerships.length ? (
              <div className="space-y-1">
                {property.ownerships.map((o) => (
                  <div key={o.id}>
                    <span className="font-medium">{o.entity.name}</span>{" "}
                    <span className="ll_muted">
                      ({o.entity.type}) • {o.ownershipPct}%
                    </span>
                    {o.startDate ? <span className="ll_muted"> • since {fmtDate(o.startDate)}</span> : null}
                    {o.endDate ? <span className="ll_muted"> • ended {fmtDate(o.endDate)}</span> : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="ll_muted">No ownership records yet.</div>
            )}
          </div>
        </div>

        {/* LEASES */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Leases</div>
            <div className="ll_spacer" />
            <Link className="ll_btn ll_btnLink" href={`/properties/${property.id}/leases`}>
              View all
            </Link>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            {activeLease ? (
              <div className="space-y-1">
                <div>
                  <span className="ll_label">Active:</span> {fmtDate(activeLease.startDate)}{" "}
                  <span className="ll_muted">to</span>{" "}
                  {activeLease.endDate ? fmtDate(activeLease.endDate) : "open"}{" "}
                  <span className="ll_muted">• due day {activeLease.dueDay}</span>
                </div>

                <div>
                  <span className="ll_label">Rent:</span> <Money value={activeLease.rentAmount} />{" "}
                  <span className="ll_label">Deposit:</span> <Money value={activeLease.deposit} />
                </div>

                <div>
                  <span className="ll_label">Managed by PM:</span> {activeLease.managedByPm ? "Yes" : "No"}
                </div>

                <div>
                  <span className="ll_label">Tenants:</span>{" "}
                  {activeLease.leaseTenants.length
                    ? activeLease.leaseTenants
                        .map((lt) => `${lt.tenant.firstName} ${lt.tenant.lastName}`)
                        .join(", ")
                    : "n/a"}
                </div>
              </div>
            ) : (
              <div className="ll_muted">No active lease found.</div>
            )}

            {property.leases.length ? (
              <div className="mt-4">
                <div className="ll_label mb-2">Recent leases</div>
                <div className="space-y-1">
                  {property.leases.map((l) => (
                    <div key={l.id} className="text-sm text-gray-700">
                      <span className="font-medium">{l.status.toUpperCase()}</span>{" "}
                      <span className="ll_muted">•</span> {fmtDate(l.startDate)}{" "}
                      <span className="ll_muted">to</span> {l.endDate ? fmtDate(l.endDate) : "n/a"}{" "}
                      <span className="ll_muted">•</span> <Money value={l.rentAmount} />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {/* PROPERTY MANAGER */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Property manager</div>
          </div>

          <div className="mt-3 text-sm text-gray-700">
            {property.pmAssignments.length ? (
              <div className="space-y-2">
                {property.pmAssignments.map((a) => (
                  <div key={a.id}>
                    <div className="font-medium">
                      {a.pm.companyName}
                      {a.pm.contactName ? <span className="ll_muted"> ({a.pm.contactName})</span> : null}
                    </div>
                    <div className="ll_muted">
                      {a.startDate ? fmtDate(a.startDate) : "n/a"} to {a.endDate ? fmtDate(a.endDate) : "present"} •{" "}
                      {a.feeType ? `${a.feeType} ${a.feeValue ?? ""}` : "fee n/a"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="ll_muted">No property manager assignment yet.</div>
            )}
          </div>
        </div>

        {/* RECENT TRANSACTIONS */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Recent transactions</div>
            <div className="ll_spacer" />
            <div className="flex flex-wrap gap-2">
              <Link className="ll_btn ll_btnLink" href={`/properties/${property.id}/ledger`}>
                View all
              </Link>
              <Link className="ll_btn ll_btnLink" href={`/properties/${property.id}/annual?year=${annualYear}`}>
                Annual
              </Link>
            </div>
          </div>

          <div className="mt-3 ll_table_wrap">
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Date</th>
                  <th>Category</th>
                  <th style={{ width: 140, textAlign: "right" }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {property.transactions.length ? (
                  property.transactions.map((t) => (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                      <td style={{ minWidth: 0 }}>
                        {t.category ? (
                          <span className="text-gray-700">
                            <span className="ll_muted">{t.category.type.toUpperCase()}</span> {" - "} {t.category.name}
                          </span>
                        ) : (
                          <span className="ll_muted">(no category)</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap", textAlign: "right" }}>
                        <span className={moneyClass(t.amount)} style={{ fontWeight: 700 }}>
                          {moneyText(t.amount)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="ll_muted">(none)</td>
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FULL WIDTH TABLES */}
      <div className="mt-4 grid grid-cols-1 gap-4">
        {/* INSURANCE */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Insurance</div>
            <div className="ll_spacer" />
            <Link
              className="ll_btn"
              href={`/insurance?q=${encodeURIComponent(property.nickname?.trim() || property.street)}`}
            >
              View all
            </Link>
          </div>

          <div className="mt-3 ll_table_wrap">
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th>Insurer</th>
                  <th style={{ width: 180 }}>Policy #</th>
                  <th style={{ width: 140 }}>Premium</th>
                  <th style={{ width: 140 }}>Due</th>
                  <th style={{ width: 140 }}>Paid</th>
                </tr>
              </thead>
              <tbody>
                {property.insurance.length ? (
                  property.insurance.map((i) => (
                    <tr key={i.id}>
                      <td>{i.insurer ?? "n/a"}</td>
                      <td>{i.policyNum ?? "n/a"}</td>
                      <td>
                        <Money value={i.premium} />
                      </td>
                      <td>{fmtDate(i.dueDate)}</td>
                      <td>{fmtDate(i.paidDate)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="ll_muted">(none)</td>
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* PROPERTY TAX */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Property tax</div>
            <div className="ll_spacer" />
            <Link className="ll_btn ll_btnLink" href={`/property-tax?propertyId=${property.id}`}>
              View all
            </Link>
          </div>

          <div className="mt-3 ll_table_wrap">
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th>Billing authority</th>
                  <th style={{ width: 160 }}>Bill #</th>
                  <th style={{ width: 160 }}>Parcel #</th>
                  <th style={{ width: 140 }}>Annual</th>
                  <th style={{ width: 140 }}>Due</th>
                  <th style={{ width: 140 }}>Last paid</th>
                  <th style={{ width: 160 }}>Phone</th>
                </tr>
              </thead>
              <tbody>
                {property.taxAccounts.length ? (
                  property.taxAccounts.map((t) => (
                    <tr key={t.id}>
                      <td>{t.name ?? "n/a"}</td>
                      <td>{t.billNumber ?? "n/a"}</td>
                      <td>{t.parcel ?? "n/a"}</td>
                      <td>
                        <Money value={t.annualAmount} />
                      </td>
                      <td>{fmtDate(t.dueDate)}</td>
                      <td>{fmtDate(t.lastPaid)}</td>
                      <td>{t.phone ?? "n/a"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="ll_muted">(none)</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ACCOUNTS */}
        <div className="ll_card">
          <div className="flex items-center gap-3">
            <div className="ll_card_title">Accounts</div>
          </div>

          <div className="mt-3">
            <div className="ll_label mb-2">Loans</div>
            {property.loans.length ? (
              <div className="space-y-1 text-sm text-gray-700">
                {property.loans.map((l) => (
                  <div key={l.id}>
                    <span className="font-medium">{l.lenderName ?? "n/a"}</span>
                    <span className="ll_muted">
                      {" "}
                      • Rate {l.ratePct ?? "n/a"}% • Term {l.termYears ?? "n/a"} yrs • Orig{" "}
                    </span>
                    <Money value={l.origAmount} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="ll_muted">No loans yet.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
