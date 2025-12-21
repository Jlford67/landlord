import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function TenantsPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();

  const tenants = await prisma.tenant.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
          ],
        }
      : undefined,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: 200,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div style={{ fontSize: 18, fontWeight: 700 }}>Tenants</div>

        {/* Match Properties: primary action row */}
        <div style={{ marginTop: 12 }}>
          <Link className="ll_btn" href="/tenants/new">
            Add tenant
          </Link>
        </div>

        {/* Search */}
        <form method="get" className="ll_form" style={{ marginTop: 14 }}>
          <label>
            Search (name, email, phone)
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
            <button
              className="ll_btnSecondary"
              type="submit"
              suppressHydrationWarning
            >
              Search
            </button>

            {q ? (
              <Link className="ll_btnSecondary" href="/tenants">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        {/* List */}
        <div style={{ marginTop: 14 }}>
          {tenants.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {tenants.map((t) => (
                <Link
                  key={t.id}
                  href={`/tenants/${t.id}`}
                  style={{
                    textDecoration: "none",
                    color: "inherit",
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                  }}
                >
                  <div style={{ fontWeight: 800 }}>
                    {t.lastName}, {t.firstName}
                  </div>
                  <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>
                    {t.email || "—"} {t.phone ? ` · ${t.phone}` : ""}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No tenants found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
