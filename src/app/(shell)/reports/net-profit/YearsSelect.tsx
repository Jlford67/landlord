"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { NetProfitYears } from "@/lib/reports/netProfit";

const OPTIONS: { label: string; value: NetProfitYears }[] = [
  { label: "1 year", value: "1" },
  { label: "3 years", value: "3" },
  { label: "5 years", value: "5" },
  { label: "10 years", value: "10" },
  { label: "15 years", value: "15" },
  { label: "All-time", value: "all" },
];

export default function YearsSelect({ value }: { value: NetProfitYears }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleChange = (next: NetProfitYears) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("years", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div>
      <label className="ll_label" htmlFor="netProfitYears">
        Years
      </label>
      {mounted ? (
        <select
          id="netProfitYears"
          className="ll_input"
          value={value}
          onChange={(event) => handleChange(event.target.value as NetProfitYears)}
          suppressHydrationWarning
        >
          {OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : (
        <div className="ll_input" style={{ height: 40 }} aria-hidden="true" />
      )}
    </div>
  );
}
