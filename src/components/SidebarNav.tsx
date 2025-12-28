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
            className="ll_btnSecondary"
            style={{
              textAlign: "left",
              fontWeight: active ? 700 : 600,
              opacity: 1,
              borderLeft: active ? "4px solid rgba(255,255,255,0.45)" : "4px solid transparent",
              paddingLeft: 12,
              background: active ? "rgba(255,255,255,0.06)" : "transparent",
            }}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
