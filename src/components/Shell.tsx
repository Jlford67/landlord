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
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <aside
        style={{
          width: 240,
          borderRight: "1px solid var(--border)",
          padding: 16,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 18, marginBottom: 16 }}>
          Landlord
        </div>

        <SidebarNav />
      </aside>

      <main style={{ flex: 1, minWidth: 0 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "20px 24px" }}>
          {children}
        </div>
      </main>

    </div>
  );
}
