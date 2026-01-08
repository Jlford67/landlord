import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import RowActions from "@/components/ui/RowActions";
import IconButton from "@/components/ui/IconButton";
import { Search, Users } from "lucide-react";
import { deleteTenant } from "./actions";

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
  const msg = getStr(sp, "msg").trim();

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
    select: { id: true, firstName: true, lastName: true, email: true, phone: true },
    take: 200,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div className="flex items-center gap-3">
            <PageTitleIcon className="bg-amber-100 text-amber-700">
              <Users size={18} />
            </PageTitleIcon>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Tenants</div>
              <div className="ll_muted">All tenants across all properties.</div>
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btn" href="/dashboard">
              Back
            </Link>
            <Link className="ll_btn ll_btnPrimary" href="/tenants/new">
              Add tenant
            </Link>
          </div>
        </div>

        {msg === "deleted" && <div className="ll_notice">Tenant deleted.</div>}
        {msg === "blocked" && <div className="ll_notice">Tenant is linked to leases and cannot be deleted.</div>}

        <div className="ll_card" style={{ marginTop: 14, marginBottom: 14 }}>
          <form method="get" className="ll_form" style={{ margin: 0 }}>
            <label>
              Search (name, email, phone)
              <input
                className="ll_input"
                name="q"
                defaultValue={q}
                placeholder="Type and press Enter..."
                autoComplete="off"
                suppressHydrationWarning
              />
            </label>

            <div style={{ display: "flex", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
              {q && (
                <Link className="ll_btn" href="/tenants">
                  Clear
                </Link>
              )}

              <IconButton
                className="ll_btn ll_btnPrimary"
                type="submit"
                ariaLabel="Search"
                title="Search"
                icon={<Search size={18} />}
              />
            </div>
          </form>
        </div>

        <div className="ll_table_wrap" style={{ marginTop: 14 }}>
          {tenants.length ? (
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th scope="col">Tenant</th>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td>
                      {t.lastName}, {t.firstName}
                    </td>
                    <td>{t.email || "-"}</td>
                    <td>{t.phone || "-"}</td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <RowActions
                        editHref={`/tenants/${t.id}`}
                        deleteAction={deleteTenant.bind(null, t.id)}
                        deleteConfirmText={`Delete tenant "${t.lastName}, ${t.firstName}"? This cannot be undone.`}
                        ariaLabelEdit={`Edit tenant ${t.lastName}, ${t.firstName}`}
                        ariaLabelDelete={`Delete tenant ${t.lastName}, ${t.firstName}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="ll_muted">No tenants found.</div>
          )}
        </div>
      </div>
    </div>
  );
}
