import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function LedgerPickerPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();

  const properties = await prisma.property.findMany({
    where: q
      ? {
          OR: [
            { nickname: { contains: q } },
            { street: { contains: q } },
            { city: { contains: q } },
            { state: { contains: q } },
            { zip: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      status: true,
    },
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div style={{ fontSize: 18, fontWeight: 700 }}>Ledger</div>
        <div className="ll_muted" style={{ marginTop: 6 }}>
          Pick a property to view and edit transactions.
        </div>

        <form method="get" className="ll_form" style={{ marginTop: 14 }}>
          <label>
            Search (nickname, street, city, state, zip)
            <input
              className="ll_input"
              name="q"
              defaultValue={q}
              placeholder="Type and press Enter…"
              autoComplete="off"
              suppressHydrationWarning
            />
          </label>

          <div style={{ display: "flex", gap: 10 }}>
            <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
              Search
            </button>

            {q ? (
              <Link className="ll_btnSecondary" href="/ledger">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div style={{ marginTop: 14 }}>
          {properties.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {properties.map((p) => (
                <Link
                  key={p.id}
                  href={`/properties/${p.id}/ledger`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "#ffffff",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {p.nickname?.trim() || "(no nickname)"}
                    {p.status && p.status !== "active" ? (
                      <span style={{ opacity: 0.7, fontWeight: 600 }}>
                        {" "}
                        • {p.status}
                      </span>
                    ) : null}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>
                    {p.street}, {p.city}, {p.state} {p.zip}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No properties found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
