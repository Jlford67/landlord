import Link from "next/link";

export default function TopNav({ userEmail }: { userEmail: string }) {
  return (
    <div style={{ padding: 16, paddingBottom: 0 }}>
      <div className="ll_panel" style={{ paddingBottom: 12 }}>
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Landlord</div>
            <div style={{ opacity: 0.8, marginTop: 2, fontSize: 13 }}>
              {userEmail}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href="/properties">
              Properties
            </Link>
            <Link className="ll_btnSecondary" href="/tenants">
              Tenants
            </Link>
            <Link className="ll_btnSecondary" href="/categories">
              Categories
            </Link>
            <Link className="ll_btnSecondary" href="/property-tax">
              Property Tax
            </Link>
            <Link className="ll_btnSecondary" href="/insurance">
              Insurance
            </Link>
            <Link className="ll_btnSecondary" href="/ledger">
              Ledger
            </Link>

            <form action="/api/auth/logout" method="post" style={{ margin: 0 }}>
              <button
                className="ll_btnSecondary"
                type="submit"
                suppressHydrationWarning
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
