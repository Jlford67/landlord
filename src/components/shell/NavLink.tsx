"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

export default function NavLink({
  href,
  label,
  icon,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
}) {
  const pathname = usePathname();

  // active when exact match OR when you're inside a section (e.g. /properties/123)
  const isPropertyLedgerRoute = /^\/properties\/[^/]+\/ledger(?:\/|$)/.test(pathname);
  const isPropertyAnnualRoute = /^\/properties\/[^/]+\/annual(?:\/|$)/.test(pathname);
  const isLedgerNav = href === "/ledger";
  const isPropertiesNav = href === "/properties";
  const isActive = isLedgerNav
    ? pathname === "/ledger" || isPropertyLedgerRoute
    : isPropertiesNav
      ? pathname === "/properties" || (/^\/properties\/[^/]+$/.test(pathname) && !isPropertyAnnualRoute)
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link href={href} className={`ll_side_link ${isActive ? "is-active" : ""}`}>
      <span className="ll_side_icon">{icon}</span>
      <span className="ll_side_label">{label}</span>
    </Link>
  );
}
