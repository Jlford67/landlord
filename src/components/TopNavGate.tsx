"use client";

import { usePathname } from "next/navigation";
import TopNav from "@/components/TopNav";

export default function TopNavGate({ userEmail }: { userEmail: string }) {
  const pathname = usePathname();

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
	

  if (hide) return null;

  return <TopNav userEmail={userEmail} />;
}
