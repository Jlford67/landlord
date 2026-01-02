export function formatUsdFromCents(cents: number): string {
  return formatUsd(cents / 100);
}

export function formatUsd(amount: number): string {
  // Fixed locale for deterministic SSR output
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
