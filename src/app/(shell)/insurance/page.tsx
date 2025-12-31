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

const insuranceColumns = [
  1.4, // Property
  1, // Insurer
  1, // Policy #
  1, // Agent
  1, // Phone
  0.9, // Premium
  0.9, // Due Date
  0.9, // Paid Date
  1.6, // Web Portal
  0.9, // Actions
];

const insuranceColumnPercents = (() => {
  const total = insuranceColumns.reduce((sum, n) => sum + n, 0);
  return insuranceColumns.map((n) => `${(n / total) * 100}%`);
})();

type SearchParams = Record<string, string | string[] | undefined>;

export default async function InsurancePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const propertyId = getStr(sp, "propertyId").trim();
  const msg = getStr(sp, "msg").trim();

  const [policies, properties] = await Promise.all([
    prisma.insurancePolicy.findMany({
      where:
        q || propertyId
          ? {
              AND: [
                q
                  ? {
                      OR: [
                        { insurer: { contains: q } },
                        { policyNum: { contains: q } },
                        { agentName: { contains: q } },
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
            <div style={{ fontSize: 18, fontWeight: 800 }}>Insurance</div>
            <div className="ll_muted">All policies across all properties.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btn" href="/insurance/new">
              Add insurance policy
            </Link>
          </div>
        </div>

        {msg === "created" && <div className="ll_notice">Policy created.</div>}
        {msg === "updated" && <div className="ll_notice">Policy updated.</div>}
        {msg === "deleted" && <div className="ll_notice">Policy deleted.</div>}

        <form method="get" className="ll_form" style={{ marginTop: 14 }}>
          <div className="ll_grid2">
            <label>
              Search (property, insurer, policy #, agent)
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
              <Link className="ll_btnSecondary" href="/insurance">
                Clear
              </Link>
            )}
          </div>
        </form>

        <div style={{ marginTop: 16 }}>
          {policies.length ? (
            <table className="ll_table ll_insuranceTable">
              <colgroup>
                {insuranceColumnPercents.map((width, idx) => (
                  <col key={idx} style={{ width }} />
                ))}
              </colgroup>

              <thead>
                <tr>
                  <th scope="col">Property</th>
                  <th scope="col">Insurer</th>
                  <th scope="col">Policy #</th>
                  <th scope="col">Agent</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Premium</th>
                  <th scope="col">Due Date</th>
                  <th scope="col">Paid Date</th>
                  <th scope="col">Web Portal</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>

              <tbody>
                {policies.map((p) => (
                  <tr key={p.id}>
                    <td style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {propertyLabel(p.property)}
                    </td>
                    <td>{p.insurer || "—"}</td>
                    <td>{p.policyNum || "—"}</td>
                    <td>{p.agentName || "—"}</td>
                    <td>{p.phone || "—"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{money(p.premium)}</td>
                    <td>{fmtDate(p.dueDate)}</td>
                    <td>{fmtDate(p.paidDate)}</td>
                    <td>
                      {p.webPortal ? (
                        <a href={p.webPortal} style={{ color: "inherit" }}>
                          {p.webPortal}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <div className="ll_rowActions">
                        <Link className="ll_btnSecondary" href={`/insurance/${p.id}/edit`}>
                          Edit
                        </Link>
                        <form action={`/api/insurance/${p.id}/delete`} method="post" style={{ margin: 0 }}>
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
            <div className="ll_notice">No insurance policies found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
