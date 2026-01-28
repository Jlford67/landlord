"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Users,
  Tags,
  Receipt,
  Shield,
  Settings,
  BarChart3,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/properties", label: "Properties", Icon: Building2 },
  { href: "/tenants", label: "Tenants", Icon: Users },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/ledger", label: "Ledger", Icon: BookOpen },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/reports/net-profit", label: "Net Profit", Icon: BarChart3 },
  { href: "/property-tax", label: "Property Tax", Icon: Receipt },
  { href: "/insurance", label: "Insurance", Icon: Shield },
  { href: "/property-managers", label: "Property manager", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  // Ledger should stay active even when nested under /properties/[id]/ledger
  if (href === "/ledger") {
    return pathname === "/ledger" || pathname.includes("/ledger");
  }

  // If ledger is active, do NOT mark properties active
  if (href === "/properties" && pathname.includes("/ledger")) {
    return false;
  }

  return pathname === href || pathname.startsWith(href + "/");
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="ll_side_nav">
      {NAV.map(({ href, label, Icon }) => {
        const active = isActivePath(pathname, href);

        return (
          <Link
            key={href}
            href={href}
            className={`ll_side_link ${active ? "is-active" : ""}`}
          >
            <span className="ll_side_icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <span className="ll_side_label">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
