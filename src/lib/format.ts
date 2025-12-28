export function fmtMoney(n: number) {
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}

export function propertyLabel(p: {
  nickname?: string | null;
  street?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
}) {
  const nick = (p.nickname ?? "").trim();
  if (nick) return nick;

  const parts = [
    (p.street ?? "").trim(),
    [p.city, p.state].filter(Boolean).join(", ").trim(),
    (p.zip ?? "").trim(),
  ].filter((x) => x && x !== ",");

  return parts.join(" ").replace(/\s+/g, " ").trim() || "Property";
}
