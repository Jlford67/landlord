import Link from "next/link";
import { ReactNode } from "react";
import SidebarNav from "@/components/SidebarNav";

type NavItem = { href: string; label: string };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/ledger", label: "Ledger" },
  { href: "/recurring", label: "Recurring" },
  { href: "/tenants", label: "Tenants" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

export default function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="ll_shell">
      <aside className="ll_shell_sidebar">
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
          Landlord
        </div>

        <SidebarNav />
      </aside>

      <main className="ll_shell_main">
        <div className="ll_shell_mainInner">{children}</div>
      </main>
    </div>
  );
}
