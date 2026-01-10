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
  LogOut,
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
  { href: "/property-managers", label: "Property manager", Icon: Users },
  { href: "/settings", label: "Settings", Icon: Settings },
];

function isActivePath(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

export default function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="ll_side_nav flex min-h-[calc(100vh-64px)] flex-col pb-16">
      <div>
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
      </div>
      <form action="/api/auth/logout" method="post" className="mt-auto pt-4">
        <button type="submit" className="ll_side_link w-full">
          <span className="ll_side_icon" aria-hidden="true">
            <LogOut size={18} />
          </span>
          <span className="ll_side_label">Logout</span>
        </button>
      </form>
    </nav>
  );
}
