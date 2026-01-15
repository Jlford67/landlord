import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, type ExcelSheet } from "@/lib/export/excel";
import {
  getReturnOnEquityReport,
  type ValuationSource,
} from "@/lib/reports/returnOnEquity";

export const runtime = "nodejs";

function parseYear(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
}

export async function GET(req: Request) {
  await requireUser();

  const url = new URL(req.url);
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const yearParam = parseYear(url.searchParams.get("year")) ?? currentYear;

  const valuationRaw = url.searchParams.get("valuation");
  const valuation: ValuationSource = valuationRaw === "redfin" ? "redfin" : "zillow";

  const propertyId = url.searchParams.get("propertyId") || null;

  const report = await getReturnOnEquityReport({
    year: yearParam,
    valuation,
    propertyId,
  });

  const rowsSheet: ExcelSheet = {
    name: "Return on Equity",
    columns: [
      { key: "property", header: "Property", type: "text", width: 32 },
      { key: "value", header: "Value", type: "currency", width: 16 },
      { key: "loanBalance", header: "Loan Balance", type: "currency", width: 16 },
      { key: "equity", header: "Equity", type: "currency", width: 16 },
      { key: "netCashFlow", header: "Net Cash Flow", type: "currency", width: 16 },
      { key: "roePct", header: "ROE %", type: "number", width: 12 },
    ],
    rows: report.rows.map((row) => ({
      property: row.propertyLabel,
      value: row.value ?? null,
      loanBalance: row.loanBalance,
      equity: row.equity ?? null,
      netCashFlow: row.netCashFlow,
      roePct: row.roePct ?? null,
    })),
  };

  const buffer = buildWorkbookBuffer([rowsSheet]);
  const filename = `return-on-equity-${valuation}-${yearParam}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
