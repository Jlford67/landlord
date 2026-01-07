import Link from "next/link";
import { fmtMoney } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  getPortfolioLeaderboardReport,
  type Metric,
  type StatusFilter,
  type ValuationSource,
} from "@/lib/reports/portfolioLeaderboard";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function parseYear(value?: string): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
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

function moneyFromCents(cents: number | null) {
  if (cents == null) return "N/A";
  return `$${fmtMoney(cents / 100)}`;
}

function fmtMoneyAccounting(cents: number | null | undefined) {
  if (cents === null || cents === undefined) {
    return { text: "N/A", className: "text-gray-500" };
  }

  const isNeg = cents < 0;
  const abs = Math.abs(cents);

  const dollars = (abs / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const text = isNeg ? `($${dollars})` : `$${dollars}`;
  const className = isNeg ? "text-red-600" : cents === 0 ? "text-gray-700" : "text-green-700";

  return { text, className };
}

function fmtPctSigned(pct: number | null | undefined) {
  if (pct === null || pct === undefined) {
    return { text: "N/A", className: "text-gray-500" };
  }

  const text = `${pct.toFixed(2)}%`;
  const className = pct < 0 ? "text-red-600" : pct === 0 ? "text-gray-700" : "text-green-700";

  return { text, className };
}

function percentValue(value: number | null) {
  if (value == null || Number.isNaN(value)) return "N/A";
  return `${value.toFixed(2)}%`;
}

function metricLabel(metric: Metric) {
  switch (metric) {
    case "netCashFlow":
      return "Net cash flow";
    case "avgMonthlyCashFlow":
      return "Avg monthly cash flow";
    case "yieldOnCostPct":
      return "Yield on cost";
    case "appreciationDollar":
      return "Appreciation ($)";
    case "appreciationPct":
      return "Appreciation (%)";
    case "totalReturnDollar":
      return "Total return ($)";
    case "totalReturnPct":
      return "Total return (%)";
    default:
      return "Metric";
  }
}

function metricDisplay(
  metric: Metric,
  row: Awaited<ReturnType<typeof getPortfolioLeaderboardReport>>["rows"][0]
) {
  switch (metric) {
    case "netCashFlow":
      return moneyFromCents(row.netCashFlowCents);
    case "avgMonthlyCashFlow":
      return moneyFromCents(row.avgMonthlyCashFlowCents);
    case "yieldOnCostPct":
      return percentValue(row.yieldOnCostPct);
    case "appreciationDollar":
      {
        const formatted = fmtMoneyAccounting(row.appreciationCents);
        return <span className={formatted.className}>{formatted.text}</span>;
      }
    case "appreciationPct":
      return percentValue(row.appreciationPct);
    case "totalReturnDollar":
      {
        const formatted = fmtMoneyAccounting(row.totalReturnCents);
        return <span className={formatted.className}>{formatted.text}</span>;
      }
    case "totalReturnPct":
      return percentValue(row.totalReturnPct);
    default:
      return "N/A";
  }
}

function amountClass(cents: number | null) {
  if (cents == null) return "text-gray-700";
  if (cents < 0) return "text-red-600";
  if (cents > 0) return "text-emerald-600";
  return "text-gray-700";
}

export default async function PortfolioLeaderboardPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};

  const metricRaw = getStr(sp, "metric");
  const metric: Metric =
    metricRaw === "avgMonthlyCashFlow" ||
    metricRaw === "yieldOnCostPct" ||
    metricRaw === "appreciationDollar" ||
    metricRaw === "appreciationPct" ||
    metricRaw === "totalReturnDollar" ||
    metricRaw === "totalReturnPct"
      ? metricRaw
      : "netCashFlow";

  const statusRaw = getStr(sp, "status");
  const status: StatusFilter =
    statusRaw === "sold" || statusRaw === "watchlist" || statusRaw === "all"
      ? statusRaw
      : "active";

  const valuationRaw = getStr(sp, "valuation");
  const valuation: ValuationSource =
    valuationRaw === "zillow" || valuationRaw === "redfin" ? valuationRaw : "auto";

  const includeTransfersRaw = getStr(sp, "includeTransfers").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const yearParam = parseYear(getStr(sp, "year"));
  const startParam = parseDateUTC(getStr(sp, "start"));
  const endParam = parseDateUTC(getStr(sp, "end"));

  let startDate = startParam ?? defaultStart;
  let endDate = endParam ?? defaultEnd;

  if (yearParam) {
    startDate = new Date(Date.UTC(yearParam, 0, 1));
    endDate = new Date(Date.UTC(yearParam, 11, 31));
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const report = await getPortfolioLeaderboardReport({
    metric,
    year: yearParam ?? undefined,
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    status,
    includeTransfers,
    valuation,
  });

  const showAppreciationNote =
    metric === "appreciationDollar" ||
    metric === "appreciationPct" ||
    metric === "totalReturnDollar" ||
    metric === "totalReturnPct";

  const totals = report.rows.reduce(
    (acc, row) => {
      acc.avgMonthlyCashFlowCents += row.avgMonthlyCashFlowCents;
      acc.netCashFlowCents += row.netCashFlowCents;

      if (row.purchasePriceCents != null) {
        acc.purchasePriceCents = (acc.purchasePriceCents ?? 0) + row.purchasePriceCents;
      }
      if (row.currentValueCents != null) {
        acc.currentValueCents = (acc.currentValueCents ?? 0) + row.currentValueCents;
      }
      if (row.appreciationCents != null) {
        acc.appreciationCents = (acc.appreciationCents ?? 0) + row.appreciationCents;
      }
      if (row.totalReturnCents != null) {
        acc.totalReturnCents = (acc.totalReturnCents ?? 0) + row.totalReturnCents;
      }

      return acc;
    },
    {
      avgMonthlyCashFlowCents: 0,
      netCashFlowCents: 0,
      purchasePriceCents: null as number | null,
      currentValueCents: null as number | null,
      appreciationCents: null as number | null,
      totalReturnCents: null as number | null,
    }
  );

  const portfolioYieldPct =
    totals.purchasePriceCents && totals.purchasePriceCents > 0
      ? (totals.netCashFlowCents / totals.purchasePriceCents) * 100
      : null;

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        <div className="ll_rowBetween">
          <div className="ll_stack" style={{ gap: 4 }}>
            <div className="ll_breadcrumbs">
              <Link href="/reports" className="ll_link">
                Reports
              </Link>
              <span className="ll_muted">/</span>
              <span className="ll_muted">Portfolio Leaderboard</span>
            </div>
            <h1>Portfolio Leaderboard</h1>
            <p className="ll_muted">
              Ranks properties by {metricLabel(report.input.metric).toLowerCase()} from{" "}
              {report.input.start} to {report.input.end}. Transfers are{" "}
              {report.input.includeTransfers ? "included" : "excluded"}.
            </p>
          </div>
        </div>

        <form className="ll_card ll_form" method="get">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label className="ll_label" htmlFor="metric">
                Ranking metric
              </label>
              <select
                id="metric"
                name="metric"
                className="ll_input"
                defaultValue={report.input.metric}
                suppressHydrationWarning
              >
                <option value="netCashFlow">Net cash flow</option>
                <option value="avgMonthlyCashFlow">Avg monthly cash flow</option>
                <option value="yieldOnCostPct">Yield on cost (%)</option>
                <option value="appreciationDollar">Appreciation ($)</option>
                <option value="appreciationPct">Appreciation (%)</option>
                <option value="totalReturnDollar">Total return ($)</option>
                <option value="totalReturnPct">Total return (%)</option>
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="year">
                Year (overrides range)
              </label>
              <input
                id="year"
                name="year"
                type="number"
                className="ll_input"
                defaultValue={report.input.year ?? ""}
                min={1900}
                max={9999}
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="start">
                Start date
              </label>
              <input
                id="start"
                name="start"
                type="date"
                className="ll_input"
                defaultValue={report.input.start}
                required
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="end">
                End date
              </label>
              <input
                id="end"
                name="end"
                type="date"
                className="ll_input"
                defaultValue={report.input.end}
                required
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                className="ll_input"
                defaultValue={report.input.status}
                suppressHydrationWarning
              >
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="watchlist">Watchlist</option>
                <option value="all">All</option>
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="valuation">
                Valuation source
              </label>
              <select
                id="valuation"
                name="valuation"
                className="ll_input"
                defaultValue={report.input.valuation}
                suppressHydrationWarning
              >
                <option value="auto">Auto</option>
                <option value="zillow">Zillow</option>
                <option value="redfin">Redfin</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id="includeTransfers"
                name="includeTransfers"
                type="checkbox"
                value="1"
                defaultChecked={report.input.includeTransfers}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                suppressHydrationWarning
              />
              <label className="ll_label m-0" htmlFor="includeTransfers">
                Include transfers
              </label>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <button type="submit" className="ll_btn ll_btnPrimary" suppressHydrationWarning>
              Apply filters
            </button>
          </div>
        </form>

        {(showAppreciationNote || report.notes.usesCurrentAppreciation) && (
          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="text-sm font-semibold text-slate-900">Appreciation note</div>
            <p className="ll_muted text-sm">
              Appreciation uses current value (Zillow/Redfin or sold price) minus purchase price.
              We don&apos;t track historical valuations by date yet.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="text-sm font-semibold text-slate-900">Totals for range</div>
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Transactional net</span>
                <span className={amountClass(report.totals.transactionalNetCents)}>
                  {moneyFromCents(report.totals.transactionalNetCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Annual net</span>
                <span className={amountClass(report.totals.annualNetCents)}>
                  {moneyFromCents(report.totals.annualNetCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Total net cash flow</span>
                <span className={amountClass(report.totals.netCashFlowCents)}>
                  {moneyFromCents(report.totals.netCashFlowCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="ll_card ll_table_wrap">
          <div className="px-4 pt-4 text-sm font-semibold text-slate-900">
            Annualized Cash Flow (Used for Monthly Metrics)
          </div>
          <p className="px-4 pb-3 text-xs text-slate-500">
            Avg monthly cash flow is computed as total annual net divided by 12.
          </p>
          <table className="ll_table ll_table_zebra w-full table-fixed">
            <thead>
              <tr>
                <th className="w-56">Property</th>
                <th className="w-40">Annual transactional net</th>
                <th className="w-40">Annual prorated net</th>
                <th className="w-40">Total annual net</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.propertyId}-annual`}>
                  <td className="font-medium text-slate-900">{row.propertyLabel}</td>
                  <td className={amountClass(row.transactionalNetCents)}>
                    {moneyFromCents(row.transactionalNetCents)}
                  </td>
                  <td className={amountClass(row.annualNetCents)}>
                    {moneyFromCents(row.annualNetCents)}
                  </td>
                  <td className={amountClass(row.netCashFlowCents)}>
                    {moneyFromCents(row.netCashFlowCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="ll_card ll_table_wrap">
          <table className="ll_table ll_table_zebra w-full table-fixed">
            <thead>
              <tr>
                <th className="w-16">Rank</th>
                <th className="w-56">Property</th>
                <th className="w-32">Status</th>
                <th className="w-40">Net cash flow</th>
                <th className="w-40">Avg monthly</th>
                <th className="w-40">Purchase price</th>
                <th className="w-40">Current value</th>
                <th className="w-40">Appreciation</th>
                <th className="w-40">Total return</th>
                <th className="w-32">Yield on cost</th>
                <th className="w-40">{metricLabel(report.input.metric)}</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row, index) => (
                <tr key={row.propertyId}>
                  <td>{row.rankValue == null ? "—" : index + 1}</td>
                  <td>
                    <div className="font-medium text-slate-900">{row.propertyLabel}</div>
                  </td>
                  <td className="capitalize">{row.status}</td>
                  <td className={amountClass(row.netCashFlowCents)}>
                    {moneyFromCents(row.netCashFlowCents)}
                  </td>
                  <td className={amountClass(row.avgMonthlyCashFlowCents)}>
                    {moneyFromCents(row.avgMonthlyCashFlowCents)}
                  </td>
                  <td>{moneyFromCents(row.purchasePriceCents)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span>{moneyFromCents(row.currentValueCents)}</span>
                      {row.currentValueSource && (
                        <span className="ll_badge capitalize">{row.currentValueSource}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    {(() => {
                      const formatted = fmtMoneyAccounting(row.appreciationCents);
                      return <span className={formatted.className}>{formatted.text}</span>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const formatted = fmtMoneyAccounting(row.totalReturnCents);
                      return <span className={formatted.className}>{formatted.text}</span>;
                    })()}
                  </td>
                  <td>
                    {(() => {
                      const formatted = fmtPctSigned(row.yieldOnCostPct);
                      return <span className={formatted.className}>{formatted.text}</span>;
                    })()}
                  </td>
                  <td className="font-semibold">{metricDisplay(report.input.metric, row)}</td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-semibold">
                <td>—</td>
                <td>Grand total</td>
                <td>—</td>
                <td>—</td>
                <td>
                  {(() => {
                    const formatted = fmtMoneyAccounting(totals.avgMonthlyCashFlowCents);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const formatted = fmtMoneyAccounting(totals.purchasePriceCents);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const formatted = fmtMoneyAccounting(totals.currentValueCents);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const formatted = fmtMoneyAccounting(totals.appreciationCents);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const formatted = fmtMoneyAccounting(totals.totalReturnCents);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>
                  {(() => {
                    const formatted = fmtPctSigned(portfolioYieldPct);
                    return <span className={formatted.className}>{formatted.text}</span>;
                  })()}
                </td>
                <td>—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
