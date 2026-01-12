"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LeaseLinkMountProps = {
  endLabel: string;
  leaseHref: string;
};

export default function LeaseLinkMount({ endLabel, leaseHref }: LeaseLinkMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <span className="inline-flex items-center gap-2 text-sm text-gray-700">
        <span className="inline-block h-4 w-24">{endLabel}</span>
        <span className="inline-block h-4 w-16">View lease</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <Link href={leaseHref} className="ll_dash_link">
        {endLabel}
      </Link>
      <Link href={leaseHref} className="ll_dash_link">
        View lease
      </Link>
    </span>
  );
}
