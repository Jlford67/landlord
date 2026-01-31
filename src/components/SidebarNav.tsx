"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

type NavItem = {
  href: string;
  label: string;
  Icon: typeof BarChart3;
};

type NavGroup = {
  label: string;
  Icon: typeof BarChart3;
  children: NavItem[];
};

const REPORTS_CHILDREN: NavItem[] = [
  { href: "/reports/net-profit", label: "Net Profit", Icon: BarChart3 },
  { href: "/reports", label: "All Reports", Icon: BarChart3 },
];

const NAV: Array<NavItem | NavGroup> = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/properties", label: "Properties", Icon: Building2 },
  { href: "/tenants", label: "Tenants", Icon: Users },
  { href: "/categories", label: "Categories", Icon: Tags },
  { href: "/ledger", label: "Ledger", Icon: BookOpen },
  { label: "Reports", Icon: BarChart3, children: REPORTS_CHILDREN },
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
  const isReportsRoute = pathname === "/reports" || pathname.startsWith("/reports/");
  const [reportsExpanded, setReportsExpanded] = useState(isReportsRoute);

  useEffect(() => {
    if (isReportsRoute) {
      setReportsExpanded(true);
    }
  }, [isReportsRoute]);

  return (
    <nav className="ll_side_nav">
      {NAV.map((item) => {
        if ("children" in item) {
          const active = isReportsRoute;
          return (
            <div key={item.label}>
              <button
                type="button"
                className={`ll_side_link w-full ${active ? "is-active" : ""}`}
                onClick={() => setReportsExpanded((prev) => !prev)}
                suppressHydrationWarning
              >
                <span className="ll_side_icon" aria-hidden="true">
                  <item.Icon size={18} />
                </span>
                <span className="ll_side_label">{item.label}</span>
              </button>
              {reportsExpanded && (
                <div className="mt-1 space-y-1">
                  {item.children.map((child) => {
                    const childActive = isActivePath(pathname, child.href);
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`ll_side_link pl-10 text-sm ${
                          childActive ? "is-active" : ""
                        }`}
                      >
                        <span className="ll_side_icon" aria-hidden="true">
                          <child.Icon size={16} />
                        </span>
                        <span className="ll_side_label">{child.label}</span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const active = isActivePath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`ll_side_link ${active ? "is-active" : ""}`}
          >
            <span className="ll_side_icon" aria-hidden="true">
              <item.Icon size={18} />
            </span>
            <span className="ll_side_label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
