"use client";

import { ReactNode, useEffect, useState } from "react";

type ClientOnlyProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export default function ClientOnly({ children, fallback = null }: ClientOnlyProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return mounted ? <>{children}</> : <>{fallback}</>;
}
