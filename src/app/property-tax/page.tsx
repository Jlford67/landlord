import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function getStr(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function money(n?: number | null) {
  if (n === null || n === undefined) return "—";

  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return n < 0 ? `(${abs})` : `$${abs}`;
}

function fmtDate(d?: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

function formatAddress(record: {
  address1: string | null;
  address2: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}) {
  const line1 = [record.address1, record.address2].filter(Boolean).join(" · ");
  const line2 = [record.city, record.state, record.zip].filter(Boolean).join(" ").trim();

  if (line1 && line2) return `${line1} (${line2})`;
  if (line1) return line1;
  if (line2) return line2;
  return "—";
}

const taxColumns = [
  1.4, // Property
  1.2, // Billing authority
  0.9, // Phone
  0.9, // Bill #
  1.4, // Address
  1, // Parcel
  0.9, // Amount
  0.9, // Due Date
  0.9, // Last Paid
  1, // Contacts
  0.9, // Actions
];

const taxColumnPercents = (() => {
  const total = taxColumns.reduce((sum, n) => sum + n, 0);
  return taxColumns.map((n) => `${(n / total) * 100}%`);
})();

type SearchParams = Record<string, string | string[] | undefined>;

export default async function PropertyTaxPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const propertyId = getStr(sp, "propertyId").trim();
  const msg = getStr(sp, "msg").trim();

  const [accounts, properties] = await Promise.all([
    prisma.propertyTaxAccount.findMany({
      where:
        q || propertyId
          ? {
              AND: [
                q
                  ? {
                      OR: [
                        { name: { contains: q } },
                        { billNumber: { contains: q } },
                        { parcel: { contains: q } },
                        { city: { contains: q } },
                        { state: { contains: q } },
                        {
                          property: {
                            OR: [
                              { nickname: { contains: q } },
                              { street: { contains: q } },
                              { city: { contains: q } },
                              { state: { contains: q } },
                              { zip: { contains: q } },
                            ],
                          },
                        },
                      ],
                    }
                  : {},
                propertyId ? { propertyId } : {},
              ],
            }
          : undefined,
      include: {
        property: {
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        },
      },
      orderBy: [{ dueDate: "desc" }],
      take: 500,
    }),
    prisma.property.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
    }),
  ]);

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Property tax</div>
            <div className="ll_muted">All tax accounts across all properties.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btn" href="/property-tax/new">
              Add tax account
            </Link>
          </div>
        </div>

        {msg === "created" && <div className="ll_notice">Tax account created.</div>}
        {msg === "updated" && <div className="ll_notice">Tax account updated.</div>}
        {msg === "deleted" && <div className="ll_notice">Tax account deleted.</div>}

        <form method="get" className="ll_form" style={{ marginTop: 14 }}>
          <div className="ll_grid2">
            <label>
              Search (property, authority, parcel, bill #)
              <input
                className="ll_input"
                name="q"
                defaultValue={q}
                placeholder="Type and press Enter…"
                autoComplete="off"
                suppressHydrationWarning
              />
            </label>

            <label>
              Property filter (optional)
              <select
                name="propertyId"
                className="ll_input"
                defaultValue={propertyId}
                suppressHydrationWarning
              >
                <option value="">All properties</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {propertyLabel(p)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
              Search
            </button>

            {(q || propertyId) && (
              <Link className="ll_btnSecondary" href="/property-tax">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {accounts.length ? (
            <table className="ll_table ll_insuranceTable">
              <colgroup>
                {taxColumnPercents.map((width, idx) => (
                  <col key={idx} style={{ width }} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Billing Authority</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Bill #</th>
                  <th scope="col">Address</th>
                  <th scope="col">Parcel #</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Last Paid</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <td style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {propertyLabel(a.property)}
                    </td>
                    <td>{a.name || "—"}</td>
                    <td>{a.phone || "—"}</td>
                    <td>{a.billNumber || "—"}</td>
                    <td>{formatAddress(a)}</td>
                    <td>{a.parcel || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{money(a.annualAmount)}</td>
                    <td>{fmtDate(a.dueDate)}</td>
                    <td>{fmtDate(a.lastPaid)}</td>
                    <td>
                      <div style={{ display: "grid", gap: 4 }}>
                        <div>{a.email || "—"}</div>
                        {a.web ? (
                          <a href={a.web} style={{ color: "inherit" }}>
                            {a.web}
                          </a>
                        ) : (
                          <span>—</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="ll_rowActions">
                        <Link className="ll_btnSecondary" href={`/property-tax/${a.id}/edit`}>
                          Edit
                        </Link>
                        <form action={`/api/property-tax/${a.id}/delete`} method="post" style={{ margin: 0 }}>
                          <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                            Delete
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ll_notice">No property tax accounts found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
