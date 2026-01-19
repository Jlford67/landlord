"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import LinkButton from "@/components/ui/LinkButton";
import Button from "@/components/ui/Button";

export default function TenantNewHeaderActions({ returnTo }: { returnTo: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  // Keep SSR stable; render a spacer until mounted (prevents LastPass fdprocessedid hydration mismatches)
  if (!mounted) {
    return <div style={{ height: 40, width: 220 }} aria-hidden="true" />;
  }

  return (
    <div className="ll_topbarRight flex flex-wrap items-center gap-2">
      <LinkButton href={returnTo} variant="outline" size="md" suppressHydrationWarning>
        <span className="inline-flex items-center gap-2">
          <ArrowLeft size={16} />
          Back
        </span>
      </LinkButton>

      <Button
        type="submit"
        form="tenant-new-form"
        variant="primary"
        size="md"
        suppressHydrationWarning
      >
        Save tenant
      </Button>
    </div>
  );
}
