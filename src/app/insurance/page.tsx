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

const insuranceColumnsStyle = {
  gridTemplateColumns:
    "1.2fr 0.9fr 0.9fr 0.9fr 0.9fr 0.8fr 0.9fr 0.9fr 1fr 1fr 0.9fr 1fr 1fr 0.9fr",
};

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
            <div className="ll_list ll_insuranceList">
              <div className="ll_listHeader" style={insuranceColumnsStyle}>
                <div>Property</div>
                <div>Insurer</div>
                <div>Policy #</div>
                <div>Agent</div>
                <div>Phone</div>
                <div>Premium</div>
                <div>Due Date</div>
                <div>Paid Date</div>
                <div>Web Portal</div>
                <div>All Policies</div>
                <div>Bank</div>
                <div>Bank Number</div>
                <div>Loan Ref</div>
                <div>Actions</div>
              </div>

              <div className="ll_listBody">
                {policies.map((p) => (
                  <div key={p.id} className="ll_listRow" style={insuranceColumnsStyle}>
                    <div style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {propertyLabel(p.property)}
                    </div>
                    <div>{p.insurer || "—"}</div>
                    <div>{p.policyNum || "—"}</div>
                    <div>{p.agentName || "—"}</div>
                    <div>{p.phone || "—"}</div>
                    <div style={{ whiteSpace: "nowrap" }}>{money(p.premium)}</div>
                    <div>{fmtDate(p.dueDate)}</div>
                    <div>{fmtDate(p.paidDate)}</div>
                    <div>
                      {p.webPortal ? (
                        <a href={p.webPortal} style={{ color: "inherit" }}>
                          {p.webPortal}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div>
                      {p.allPolicies ? (
                        <a href={p.allPolicies} style={{ color: "inherit" }}>
                          {p.allPolicies}
                        </a>
                      ) : (
                        "—"
                      )}
                    </div>
                    <div>{p.bank || "—"}</div>
                    <div>{p.bankNumber || "—"}</div>
                    <div>{p.loanRef || "—"}</div>
                    <div>
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
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="ll_notice">No insurance policies found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
