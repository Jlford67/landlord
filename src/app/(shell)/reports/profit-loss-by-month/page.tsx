import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getProfitLossByMonth } from "@/lib/reports/profitLossByMonth";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function parseDateUTC(value?: string): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function formatInputDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function moneyAccounting(n: number) {
  const abs = Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return n < 0 ? `($${abs})` : `$${abs}`;
}

function amountClass(n: number) {
  if (n < 0) return "text-red-600";
  if (n > 0) return "text-emerald-600";
  return "text-gray-700";
}

export default async function ProfitLossByMonthPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};

  const propertyId = getStr(sp, "propertyId") || null;
  const includeTransfers = getStr(sp, "includeTransfers") === "true";
  const includeAnnualTotals = getStr(sp, "includeAnnualTotals") !== "false";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

  const parsedStart = parseDateUTC(getStr(sp, "startDate"));
  const parsedEnd = parseDateUTC(getStr(sp, "endDate"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const exportParams = new URLSearchParams();
  if (propertyId) exportParams.set("propertyId", propertyId);
  exportParams.set("startDate", formatInputDateUTC(startDate));
  exportParams.set("endDate", formatInputDateUTC(endDate));
  exportParams.set("includeTransfers", includeTransfers ? "true" : "false");
  exportParams.set("includeAnnualTotals", includeAnnualTotals ? "true" : "false");
  const exportHref = `/api/exports/reports/profit-loss-by-month?${exportParams.toString()}`;

  const properties = await prisma.property.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: propertyLabel(p),
  }));

  const result = await getProfitLossByMonth({
    propertyId,
    startDate: formatInputDateUTC(startDate),
    endDate: formatInputDateUTC(endDate),
    includeTransfers,
    includeAnnualTotals,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_rowBetween">
          <div>
            <div className="ll_breadcrumbs">
              <Link href="/reports" className="ll_link">
                Reports
              </Link>
              <span className="ll_muted">/</span>
              <span className="ll_muted">Profit &amp; Loss by Month</span>
            </div>
            <h1>Profit &amp; Loss by Month (Trend)</h1>
            <div className="ll_muted">
              Monthly ledger totals and prorated annual amounts within the selected date
              range. Transfers are {includeTransfers ? "included" : "excluded"}.
              Annual totals are {includeAnnualTotals ? "included" : "excluded"}.
            </div>
          </div>
          <a className="ll_btn" href={exportHref}>
            Export Excel
          </a>
        </div>

        <form className="ll_form mt-4" method="get">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label className="ll_label" htmlFor="propertyId">
                Property (optional)
              </label>
              <select
                id="propertyId"
                name="propertyId"
                className="ll_input"
                defaultValue={propertyId ?? ""}
                suppressHydrationWarning
              >
                <option value="">All properties</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="startDate">
                Start date
              </label>
              <input
                id="startDate"
                name="startDate"
                type="date"
                className="ll_input"
                defaultValue={formatInputDateUTC(startDate)}
                required
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="endDate">
                End date
              </label>
              <input
                id="endDate"
                name="endDate"
                type="date"
                className="ll_input"
                defaultValue={formatInputDateUTC(endDate)}
                required
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="includeTransfers">
                Include transfers?
              </label>
              <select
                id="includeTransfers"
                name="includeTransfers"
                className="ll_input"
                defaultValue={includeTransfers ? "true" : "false"}
                suppressHydrationWarning
              >
                <option value="false">No</option>
                <option value="true">Yes</option>
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="includeAnnualTotals">
                Include annual totals?
              </label>
              <select
                id="includeAnnualTotals"
                name="includeAnnualTotals"
                className="ll_input"
                defaultValue={includeAnnualTotals ? "true" : "false"}
                suppressHydrationWarning
              >
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <button type="submit" className="ll_btn ll_btnPrimary" suppressHydrationWarning>
              Apply filters
            </button>
          </div>
        </form>

        <div className="mt-6 ll_table_wrap">
          <table className="ll_table ll_table_zebra w-full table-fixed">
            <colgroup>
              <col style={{ width: "40%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Month</th>
                <th className="!text-right">Income</th>
                <th className="!text-right">Expense</th>
                <th className="!text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {result.months.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-slate-600">
                    No data for this range.
                  </td>
                </tr>
              ) : (
                result.months.map((row) => (
                  <tr key={row.month}>
                    <td>{row.month}</td>
                    <td className="text-right">
                      <span className={amountClass(row.incomeTotal)}>
                        {moneyAccounting(row.incomeTotal)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={amountClass(row.expenseTotal)}>
                        {moneyAccounting(row.expenseTotal)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={amountClass(row.netTotal)}>
                        {moneyAccounting(row.netTotal)}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="ll_table_total">
                <td>Totals</td>
                <td className="text-right">
                  <span className={amountClass(result.totals.incomeTotal)}>
                    {moneyAccounting(result.totals.incomeTotal)}
                  </span>
                </td>
                <td className="text-right">
                  <span className={amountClass(result.totals.expenseTotal)}>
                    {moneyAccounting(result.totals.expenseTotal)}
                  </span>
                </td>
                <td className="text-right">
                  <span className={amountClass(result.totals.netTotal)}>
                    {moneyAccounting(result.totals.netTotal)}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 ll_muted text-sm">
          TODO: Add visual charting for month-over-month trends.
        </div>
      </div>
    </div>
  );
}
