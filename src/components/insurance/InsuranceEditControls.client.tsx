"use client";

import { useEffect, useMemo, useState } from "react";

type InsuranceEditControlsProps = {
  premiumValue?: number | null;
  autoPayMonthly: boolean;
};

const placeholderHeight = 96;

function formatCurrency(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function InsuranceEditControls({
  premiumValue,
  autoPayMonthly,
}: InsuranceEditControlsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const formattedPremium = useMemo(() => formatCurrency(premiumValue), [premiumValue]);

  if (!mounted) {
    return <div aria-hidden="true" style={{ height: placeholderHeight }} />;
  }

  return (
    <>
      <label className="ll_label" htmlFor="premium">
        Premium
      </label>
      <input
        id="premium"
        name="premium"
        type="text"
        className="ll_input"
        inputMode="decimal"
        defaultValue={formattedPremium}
        suppressHydrationWarning
      />

      <label className="ll_label" style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          id="autoPayMonthly"
          name="autoPayMonthly"
          type="checkbox"
          defaultChecked={autoPayMonthly}
          suppressHydrationWarning
        />
        AutoPay Monthly
      </label>
      <div className="ll_muted" style={{ marginTop: -6, marginBottom: 10 }}>
        AutoPay Monthly policies are excluded from reminders.
      </div>
    </>
  );
}
