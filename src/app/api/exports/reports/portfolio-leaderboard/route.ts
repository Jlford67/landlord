import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import {
  getPortfolioLeaderboardReport,
  type Metric,
  type StatusFilter,
  type ValuationSource,
} from "@/lib/reports/portfolioLeaderboard";

export const runtime = "nodejs";

function parseYear(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
}

function parseDateUTC(value?: string | null): Date | null {
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

function centsToDollars(value: number | null) {
  return value == null ? null : value / 100;
}

function parseYmdToDate(value?: string | null): Date | null {
  if (!value) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const metricRaw = url.searchParams.get("metric");
  const metric: Metric =
    metricRaw === "avgMonthlyCashFlow" ||
    metricRaw === "yieldOnCostPct" ||
    metricRaw === "appreciationDollar" ||
    metricRaw === "appreciationPct" ||
    metricRaw === "totalReturnDollar" ||
    metricRaw === "totalReturnPct"
      ? metricRaw
      : "netCashFlow";

  const statusRaw = url.searchParams.get("status");
  const status: StatusFilter =
    statusRaw === "sold" || statusRaw === "watchlist" || statusRaw === "all"
      ? statusRaw
      : "active";

  const valuationRaw = url.searchParams.get("valuation");
  const valuation: ValuationSource =
    valuationRaw === "zillow" || valuationRaw === "redfin" ? valuationRaw : "auto";

  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const yearParam = parseYear(url.searchParams.get("year"));
  const startParam = parseDateUTC(url.searchParams.get("start"));
  const endParam = parseDateUTC(url.searchParams.get("end"));

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

  const rowsSheet: ExcelSheet = {
    name: "Portfolio Leaderboard",
    columns: [
      { key: "rank", header: "Rank", type: "number", width: 8 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "status", header: "Status", type: "text", width: 12 },
      { key: "purchasePrice", header: "Purchase Price", type: "currency", width: 16 },
      { key: "purchaseDate", header: "Purchase Date", type: "date", width: 12 },
      { key: "currentValue", header: "Current Value", type: "currency", width: 16 },
      { key: "currentValueSource", header: "Value Source", type: "text", width: 14 },
      { key: "transactionalNet", header: "Transactional Net", type: "currency", width: 16 },
      { key: "annualNet", header: "Annual Net", type: "currency", width: 16 },
      { key: "netCashFlow", header: "Net Cash Flow", type: "currency", width: 16 },
      { key: "avgMonthlyCashFlow", header: "Avg Monthly Cash Flow", type: "currency", width: 18 },
      { key: "totalAnnualNet", header: "Total Annual Net", type: "currency", width: 18 },
      { key: "yieldOnCostPct", header: "Yield on Cost (%)", type: "number", width: 16 },
      { key: "appreciation", header: "Appreciation", type: "currency", width: 16 },
      { key: "appreciationPct", header: "Appreciation (%)", type: "number", width: 16 },
      { key: "totalReturn", header: "Total Return", type: "currency", width: 16 },
      { key: "totalReturnPct", header: "Total Return (%)", type: "number", width: 16 },
      { key: "metricValue", header: "Metric Value", type: "number", width: 16 },
    ],
    rows: report.rows.map((row, index) => ({
      rank: row.rankValue == null ? null : index + 1,
      propertyId: row.propertyId,
      propertyName: row.propertyLabel,
      status: row.status,
      purchasePrice: centsToDollars(row.purchasePriceCents),
      purchaseDate: parseYmdToDate(row.purchaseDate),
      currentValue: centsToDollars(row.currentValueCents),
      currentValueSource: row.currentValueSource ?? "",
      transactionalNet: centsToDollars(row.transactionalNetCents),
      annualNet: centsToDollars(row.annualNetCents),
      netCashFlow: centsToDollars(row.netCashFlowCents),
      avgMonthlyCashFlow: centsToDollars(row.avgMonthlyCashFlowCents),
      totalAnnualNet: centsToDollars(row.totalAnnualNetCents),
      yieldOnCostPct: row.yieldOnCostPct ?? null,
      appreciation: centsToDollars(row.appreciationCents),
      appreciationPct: row.appreciationPct ?? null,
      totalReturn: centsToDollars(row.totalReturnCents),
      totalReturnPct: row.totalReturnPct ?? null,
      metricValue: row.rankValue ?? null,
    })),
  };

  const buffer = buildWorkbookBuffer([rowsSheet]);
  const filename = `portfolio-leaderboard-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
