import { requireUser } from "@/lib/auth";
import TenantFormMount from "./TenantFormMount";

import { Users } from "lucide-react";
import PageTitleIcon from "@/components/ui/PageTitleIcon";
import TenantNewHeaderActions from "./TenantNewHeaderActions";

export default async function NewTenantPage({
  searchParams,
}: {
  searchParams?: Promise<{ returnTo?: string }>;
}) {
  await requireUser();

  const sp = searchParams ? await searchParams : undefined;
  const returnTo = sp?.returnTo || "/properties";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div className="flex items-center gap-3">
            <PageTitleIcon className="bg-amber-100 text-amber-700">
              <Users size={18} />
            </PageTitleIcon>

            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>New tenant</div>
              <div className="ll_muted">Create a tenant record.</div>
            </div>
          </div>

          {/* header buttons submit the inner form by id */}
          <TenantNewHeaderActions returnTo={returnTo} />
        </div>

        <TenantFormMount returnTo={returnTo} />
      </div>
    </div>
  );
}
