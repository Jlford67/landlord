"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function TopNavGate({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Hide TopNav on the new shell pages
  const hide =
    pathname === "/dashboard" ||
    pathname.startsWith("/dashboard/") ||
    pathname === "/recurring" ||
    pathname.startsWith("/recurring/") ||
    pathname === "/tenants" ||
    pathname.startsWith("/tenants/") ||
    pathname === "/ledger" ||
    pathname.startsWith("/ledger/") ||
    pathname === "/properties" ||
    pathname.startsWith("/properties/");

  if (!mounted || hide) return null;

  return <TopNav userEmail={userEmail} />;
}
