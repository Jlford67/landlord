"use client";

import { useEffect, useState } from "react";
import TenantFormClient from "./TenantFormClient";

export default function TenantFormMount({ returnTo }: { returnTo: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Important: render nothing on the server + first client paint
  // so extensions can't cause a server/client DOM mismatch.
  if (!mounted) return null;

  return <TenantFormClient returnTo={returnTo} />;
}
