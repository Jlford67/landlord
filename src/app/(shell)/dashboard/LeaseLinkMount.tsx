"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type LeaseLinkMountProps = {
  label: string;
  href: string;
  className?: string;
};

export default function LeaseLinkMount({ label, href, className }: LeaseLinkMountProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <span className={`inline-block ${className ?? ""}`}>{label}</span>;
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}
