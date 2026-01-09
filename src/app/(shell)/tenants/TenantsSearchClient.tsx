"use client";

import Link from "next/link";
import IconButton from "@/components/ui/IconButton";
import { Search } from "lucide-react";

export default function TenantsSearchClient({ q }: { q: string }) {
  return (
    <div className="ll_card" style={{ marginTop: 14, marginBottom: 14 }}>
      <form method="get" className="ll_form" style={{ margin: 0 }} data-lpignore="true">
        <div className="ll_label mb-1">Search (name, email, phone)</div>

        <div className="flex items-center gap-2">
          <input
            className="ll_input"
            name="q"
            defaultValue={q}
            placeholder="Type and press Enter..."
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore
          />

          <IconButton
            className="ll_btn ll_btnPrimary"
            type="submit"
            ariaLabel="Search"
            title="Search"
            icon={<Search size={18} />}
          />

          {q && (
            <Link className="ll_btn" href="/tenants">
              Clear
            </Link>
          )}
        </div>
      </form>
    </div>
  );
}
