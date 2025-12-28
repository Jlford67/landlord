import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  await requireUser();

  const sp = searchParams ? await searchParams : undefined;
  const returnTo = sp?.returnTo || "/properties";

  return (
    <div className="ll_page" suppressHydrationWarning>
      <div className="ll_panel">
        <div className="ll_topbar">
          <div style={{ fontSize: 18, fontWeight: 700 }}>New tenant</div>
          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={returnTo}>
              Back
            </Link>
          </div>
        </div>

        <form className="ll_form" action="/api/tenants" method="post">
          <input type="hidden" name="returnTo" value={returnTo} />

          <label>
            First name
            <input className="ll_input" name="firstName" required />
          </label>

          <label>
            Last name
            <input className="ll_input" name="lastName" required />
          </label>

          <label>
            Email (optional)
            <input className="ll_input" name="email" />
          </label>

          <label>
            Phone (optional)
            <input className="ll_input" name="phone" />
          </label>

          <label>
            Notes (optional)
            <input className="ll_input" name="notes" />
          </label>

          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="ll_btn" type="submit">
              Save tenant
            </button>

            <Link className="ll_btnSecondary" href={returnTo}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
