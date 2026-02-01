"use client";

import * as React from "react";

export default function MountedLeaseForm({
  children,
  placeholderHeight = 420,
}: {
  children: React.ReactNode;
  placeholderHeight?: number;
}) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Stable SSR placeholder to avoid hydration mismatch + layout jump
    return <div style={{ height: placeholderHeight }} aria-hidden="true" />;
  }

  return <>{children}</>;
}
