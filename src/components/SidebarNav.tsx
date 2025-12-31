"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = { href: string; label: string };

const nav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/properties", label: "Properties" },
  { href: "/tenants", label: "Tenants" },
  { href: "/categories", label: "Categories" },
  { href: "/recurring", label: "Recurring" },
  { href: "/ledger", label: "Ledger" },
  { href: "/property-tax", label: "Property Tax" },
  { href: "/insurance", label: "Insurance" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {nav.map((item) => {
        const active = isActive(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              textAlign: "left",
              textDecoration: "none",
          
              padding: "10px 12px",
              paddingLeft: 12,
          
              borderRadius: 10,
              border: "1px solid transparent",
              borderLeft: active ? "4px solid var(--primary)" : "4px solid transparent",
          
              background: active ? "#ffffff" : "transparent",
          
              color: active ? "var(--text)" : "#374151",
              fontWeight: active ? 800 : 650,
            }}
>
  {item.label}
</Link>

        );
      })}
    </nav>
  );
}
