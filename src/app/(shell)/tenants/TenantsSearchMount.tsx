"use client";

import { useEffect, useState } from "react";
import TenantsSearchClient from "./TenantsSearchClient";

export default function TenantsSearchMount({ q }: { q: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return <TenantsSearchClient q={q} />;
}
