export function fmtMoney(n: number) {
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
  });
  return n < 0 ? `(${abs})` : abs;
}
