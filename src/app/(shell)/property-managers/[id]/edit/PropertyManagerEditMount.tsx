"use client";

import { useEffect, useState } from "react";

export default function PropertyManagerEditMount({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // IMPORTANT:
  // SSR renders ONLY this placeholder (no inputs/buttons/forms),
  // so LastPass has nothing to inject into pre-hydration.
  if (!mounted) {
    return (
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              Edit property manager
            </div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Loading…</div>
          </div>
        </div>
        <div style={{ paddingTop: 12 }} />
      </div>
    );
  }

  return <>{children}</>;
}
