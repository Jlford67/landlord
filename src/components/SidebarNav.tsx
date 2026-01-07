"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  BookOpen,
  Repeat,
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
  { href: "/recurring", label: "Recurring", Icon: Repeat },
  { href: "/ledger", label: "Ledger", Icon: BookOpen },
  { href: "/reports", label: "Reports", Icon: BarChart3 },
  { href: "/property-tax", label: "Property Tax", Icon: Receipt },
  { href: "/insurance", label: "Insurance", Icon: Shield },
  { href: "/property-managers", label: "Property managers", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function isActivePath(pathname: string, href: string) {
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
