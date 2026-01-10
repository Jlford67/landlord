import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";
import SidebarLogoutClient from "@/components/SidebarLogoutClient";
import SidebarNav from "@/components/SidebarNav";

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ll_shell">
      <aside className="ll_shell_sidebar">
        <div className="ll_shell_sidebarInner">
          <div className="ll_side_header">
            <Link href="/dashboard" className="ll_side_logo" aria-label="Landlord">
              <Image
                src="/brand/landlord-logo.png"
                alt="Landlord"
                width={240}
                height={64}
                className="ll_side_logoImage"
                priority
              />
            </Link>
            <div className="ll_side_divider" role="presentation" />
          </div>

          <div className="ll_side_navWrap">
            <SidebarNav />
          </div>

          <div className="ll_side_footer">
            <SidebarLogoutClient />
          </div>
        </div>
      </aside>

      <main className="ll_shell_main">
        <div className="ll_shell_mainInner">{children}</div>
      </main>
    </div>
  );
}
