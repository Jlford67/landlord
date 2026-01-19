"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import LinkButton from "@/components/ui/LinkButton";

export default function LedgerHeaderActions(props: {
  backHref: string;
  addTxHref: string;
  addAnnualHref: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // SSR-stable spacer (LastPass-safe)
  if (!mounted) return <div style={{ height: 40, width: 430 }} aria-hidden="true" />;

return (
  <div className="ll_topbarRight flex flex-wrap items-center gap-2">
    <LinkButton href={props.backHref} variant="outline" size="md" suppressHydrationWarning>
      <span className="inline-flex items-center gap-2">
        <ArrowLeft size={16} />
        Back
      </span>
    </LinkButton>

    <LinkButton href={props.addAnnualHref} variant="warning" size="md" suppressHydrationWarning>
      <span className="inline-flex items-center gap-2">
        <Plus size={16} />
        Add annual entry
      </span>
    </LinkButton>

    <LinkButton href={props.addTxHref} variant="warning" size="md" suppressHydrationWarning>
      <span className="inline-flex items-center gap-2">
        <Plus size={16} />
        Add transaction
      </span>
    </LinkButton>
  </div>
);


}
