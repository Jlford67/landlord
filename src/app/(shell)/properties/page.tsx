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

function getMsg(sp: SearchParams): string {
  return getStr(sp, "msg").trim();
}

export default async function PropertiesPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();
  if (!user) redirect("/login");

  const sp = searchParams ? await searchParams : {};
  const q = getStr(sp, "q").trim();
  const msg = getMsg(sp);

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
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div style={{ fontSize: 18, fontWeight: 700 }}>Properties</div>

        {msg === "deleted" && <div className="ll_notice">Property deleted.</div>}
        {msg === "deactivated" && (
          <div className="ll_notice">
            Property has leases or transactions, so it was marked inactive instead of deleted.
          </div>
        )}
		{msg === "reactivated" && <div className="ll_notice">Property reactivated.</div>}
        {msg === "notfound" && <div className="ll_notice">Property not found.</div>}

        <div style={{ marginTop: 12 }}>
          <Link className="ll_btn" href="/properties/new">
            Add property
          </Link>
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
              <Link className="ll_btnSecondary" href="/properties">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div style={{ marginTop: 14 }}>
          {properties.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {properties.map((p) => (
                <div
                  key={p.id}
                  style={{
                    border: "1px solid rgba(255,255,255,0.10)",
                    borderRadius: 12,
                    padding: "10px 12px",
                    background: "rgba(255,255,255,0.03)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                  }}
                >
                  {/* Left side: clickable details */}
                  <Link
                    href={`/properties/${p.id}`}
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      flex: 1,
                      minWidth: 0,
                    }}
                  >
                    <div style={{ fontWeight: 800 }}>
                      {p.nickname?.trim() || "(no nickname)"}
                      {p.status && p.status !== "active" ? (
                        <span style={{ opacity: 0.7, fontWeight: 600 }}> • {p.status}</span>
                      ) : null}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13, marginTop: 2 }}>
                      {p.street}, {p.city}, {p.state} {p.zip}
                    </div>
                  </Link>

                  {/* Right side: actions */}
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <Link className="ll_btnSecondary" href={`/properties/${p.id}/ledger`}>
                      Ledger
                    </Link>

                   {p.status && p.status !== "active" ? (
                   <form method="post" action={`/api/properties/${p.id}/reactivate`} style={{ margin: 0 }}>
                     <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                       Reactivate
                     </button>
                   </form>

                   ) : (
                     <form method="post" action={`/api/properties/${p.id}/delete`} style={{ margin: 0 }}>
                       <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                         Delete
                       </button>
                     </form>
                   )}

                  </div>
                </div>
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
