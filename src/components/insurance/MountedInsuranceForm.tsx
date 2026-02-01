"use client";

import React, { useEffect, useState } from "react";

type Props = {
  children: React.ReactNode;
  placeholderHeight?: number;
};

export default function MountedInsuranceForm({ children, placeholderHeight = 260 }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // Stable SSR markup: LastPass can't inject into inputs that aren't rendered yet.
    return <div style={{ height: placeholderHeight }} suppressHydrationWarning />;
  }

  return <>{children}</>;
}
