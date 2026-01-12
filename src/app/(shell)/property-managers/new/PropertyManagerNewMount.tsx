"use client";

import { useEffect, useState } from "react";

export default function PropertyManagerNewMount({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              New property manager
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
