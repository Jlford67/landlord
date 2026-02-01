"use client";

import * as React from "react";

function formatUsd(value: string) {
  if (!value) return "";

  // Remove everything except digits and dot
  let cleaned = value.replace(/[^0-9.]/g, "");

  // Prevent more than one decimal point
  const parts = cleaned.split(".");
  if (parts.length > 2) {
    cleaned = parts[0] + "." + parts.slice(1).join("");
  }

  const [dollarsRaw, centsRaw] = cleaned.split(".");

  // Format dollars with commas
  const dollars = (dollarsRaw || "")
    .replace(/^0+(?=\d)/, "")
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");

  // Limit cents to 2 digits, but don’t force them
  const cents =
    centsRaw !== undefined ? "." + centsRaw.slice(0, 2) : "";

  return `$${dollars || "0"}${cents}`;
}

type Props = {
  name: string;
  id?: string;
  className?: string;
  defaultValue?: number | null;
};

export default function PremiumMoneyInput({
  name,
  id,
  className,
  defaultValue,
}: Props) {
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    if (defaultValue != null && Number.isFinite(defaultValue)) {
      setValue(defaultValue.toString());
    }
  }, [defaultValue]);

  return (
    <input
      id={id}
      name={name}
      type="text"
      inputMode="decimal"
      className={className}
      autoComplete="off"
      value={formatUsd(value)}
      onChange={(e) => setValue(e.target.value)}
      suppressHydrationWarning
    />
  );
}
