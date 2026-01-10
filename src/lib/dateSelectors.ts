export function isValidYearString(s: string): boolean {
  if (!/^\d{4}$/.test(s)) return false;
  const year = Number(s);
  return Number.isFinite(year) && year >= 1900 && year <= 2200;
}

export function normalizeYear(input: unknown, fallbackYear: number): number {
  if (typeof input !== "string") return fallbackYear;
  if (!isValidYearString(input)) return fallbackYear;
  return Math.trunc(Number(input));
}

export function isValidMonthString(s: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(s)) return false;
  const [yearRaw, monthRaw] = s.split("-");
  if (!isValidYearString(yearRaw)) return false;
  const month = Number(monthRaw);
  return Number.isFinite(month) && month >= 1 && month <= 12;
}

export function normalizeMonth(input: unknown, fallbackMonth: string): string {
  if (typeof input !== "string") return fallbackMonth;
  if (!isValidMonthString(input)) return fallbackMonth;
  return input;
}

export function yearToMonth(year: number, month1to12: number): string {
  const mm = String(month1to12).padStart(2, "0");
  return `${year}-${mm}`;
}

export function monthToYear(month: string): number {
  return Number(month.split("-")[0]);
}
