import { requireUser } from "@/lib/auth";
import TenantFormMount from "./TenantFormMount";

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

        <TenantFormMount returnTo={returnTo} />

      </div>
    </div>
  );
}
