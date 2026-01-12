"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LeaseLinkMountProps = {
  endLabel: string;
  leaseHref: string;
  severity: "expired" | "soon" | "ok";
};

const severityClass = {
  expired: "text-red-600",
  soon: "text-amber-600",
  ok: "ll_dash_link",
};

export default function LeaseLinkMount({ endLabel, leaseHref, severity }: LeaseLinkMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const className = severityClass[severity];

  if (!mounted) {
    return <span className={`inline-block text-sm ${className}`}>{endLabel}</span>;
  }

  return (
    <Link href={leaseHref} className={`text-sm ${className}`}>
      {endLabel}
    </Link>
  );
}
