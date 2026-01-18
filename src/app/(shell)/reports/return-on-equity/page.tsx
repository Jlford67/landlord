import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  getReturnOnEquityReport,
  type ValuationSource,
} from "@/lib/reports/returnOnEquity";
import Button from "@/components/ui/Button";
import { ArrowLeft, Download } from "lucide-react";
import LinkButton from "@/components/ui/LinkButton";

type SearchParams = Record<string, string | string[] | undefined>;

type YearOption = {
  label: string;
  value: number;
};

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

function formatCurrency(value: number | null) {
  if (value == null) {
    return { text: "—", className: "text-gray-500" };
  }

  const abs = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const text = value < 0 ? `($${abs})` : `$${abs}`;
  const className = value < 0 ? "text-red-600" : "text-gray-800";
  return { text, className };
}

function amountClass(value: number) {
  if (value < 0) return "text-red-600";
  if (value > 0) return "text-emerald-600";
  return "text-gray-700";
}

function formatPercent(value: number | null) {
  if (value == null || Number.isNaN(value)) {
    return { text: "N/A", className: "text-gray-500" };
  }
  const text = `${value.toFixed(2)}%`;
  const className = value < 0 ? "text-red-600" : value > 0 ? "text-emerald-600" : "text-gray-700";
  return { text, className };
}

function buildYearOptions(currentYear: number): YearOption[] {
  const options: YearOption[] = [];
  for (let offset = 3; offset >= -1; offset -= 1) {
    const year = currentYear - offset;
    options.push({ label: String(year), value: year });
  }
  return options;
}

function buildExportHref(params: {
  year: number;
  valuation: ValuationSource;
  propertyId: string | null;
}) {
  const exportParams = new URLSearchParams();
  exportParams.set("year", String(params.year));
  exportParams.set("valuation", params.valuation);
  if (params.propertyId) exportParams.set("propertyId", params.propertyId);
  return `/api/exports/reports/return-on-equity?${exportParams.toString()}`;
}

function buildReportLink(params: {
  year: number;
  valuation: ValuationSource;
  propertyId?: string | null;
  anchor?: string;
}) {
  const searchParams = new URLSearchParams();
  searchParams.set("year", String(params.year));
  searchParams.set("valuation", params.valuation);
  if (params.propertyId) searchParams.set("propertyId", params.propertyId);
  const anchor = params.anchor ? `#${params.anchor}` : "";
  return `/reports/return-on-equity?${searchParams.toString()}${anchor}`;
}

export default async function ReturnOnEquityPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const yearParam = parseYear(getStr(sp, "year")) ?? currentYear;

  const valuationRaw = getStr(sp, "valuation");
  const valuation: ValuationSource = valuationRaw === "redfin" ? "redfin" : "zillow";

  const propertyIdRaw = getStr(sp, "propertyId");
  const propertyId = propertyIdRaw ? propertyIdRaw : null;

  const [properties, report] = await Promise.all([
    prisma.property.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        nickname: true,
        street: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
    getReturnOnEquityReport({
      year: yearParam,
      valuation,
      propertyId,
    }),
  ]);

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: propertyLabel(p),
  }));

  const yearOptions = buildYearOptions(currentYear);
  const exportHref = buildExportHref({ year: yearParam, valuation, propertyId });

  const drillProperty = propertyId
    ? propertyOptions.find((option) => option.id === propertyId) ?? null
    : null;

  const drilldownRows = propertyId
    ? report.profitLossRows.filter((row) => row.propertyId === propertyId)
    : [];

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 20 }}>
        {/* Page header */}
        <div className="ll_card">
          <div className="ll_topbar">
            <div className="min-w-0">
              <div className="ll_breadcrumbs">
                <Link href="/reports" className="ll_link">
                  Reports
                </Link>
                <span className="ll_muted">/</span>
                <span className="ll_muted">Return on Equity</span>
              </div>

              <h1>Return on Equity</h1>

              <p className="ll_muted break-words">
                Compare cash flow returns against current equity for {yearParam}.
              </p>
            </div>

            <div className="flex shrink-0 items-start gap-2">
              <LinkButton
                href="/reports"
                variant="outline"
                size="md"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
                suppressHydrationWarning
              >
                Back
              </LinkButton>

              <form action={exportHref} method="get">
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  leftIcon={<Download className="h-4 w-4" />}
                  suppressHydrationWarning
                >
                  Export Excel
                </Button>
              </form>
            </div>
          </div>
        </div>

        <form className="ll_form" method="get">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            }}
          >
            <div>
              <label className="ll_label" htmlFor="year">
                Year
              </label>
              <select
                id="year"
                name="year"
                className="ll_input"
                defaultValue={String(yearParam)}
                suppressHydrationWarning
              >
                {yearOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
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
                defaultValue={valuation}
                suppressHydrationWarning
              >
                <option value="zillow">Zillow</option>
                <option value="redfin">Redfin</option>
              </select>
            </div>

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
                {propertyOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <Button type="submit" variant="warning" size="md" suppressHydrationWarning>
              Apply filters
            </Button>
          </div>

        </form>

        <div className="ll_card">
          <div className="ll_table_wrap">
            <table className="ll_table ll_table_zebra w-full">
              <colgroup>
                <col />
                <col style={{ width: "140px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "140px" }} />
                <col style={{ width: "160px" }} />
                <col style={{ width: "110px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="text-right">Value</th>
                  <th className="text-right">Loan balance</th>
                  <th className="text-right">Equity</th>
                  <th className="text-right">Net cash flow</th>
                  <th className="text-right">ROE %</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-sm text-slate-600">
                      No properties found for this selection.
                    </td>
                  </tr>
                ) : (
                  report.rows.map((row) => {
                    const valueDisplay = formatCurrency(row.value);
                    const loanBalanceDisplay = formatCurrency(row.loanBalance);
                    const equityDisplay = formatCurrency(row.equity);
                    const netCashFlowDisplay = formatCurrency(row.netCashFlow);
                    const roeDisplay = formatPercent(row.roePct);
                    const propertyHref = buildReportLink({
                      year: yearParam,
                      valuation,
                      propertyId: row.propertyId,
                      anchor: "drilldown",
                    });
                    return (
                      <tr key={row.propertyId}>
                        <td>
                          <Link href={propertyHref} className="ll_link">
                            {row.propertyLabel}
                          </Link>
                        </td>
                        <td className="text-right">
                          <span
                            className={`${valueDisplay.className} text-slate-700 dark:text-slate-200`}
                          >
                            {valueDisplay.text}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={`${loanBalanceDisplay.className} text-slate-700 dark:text-slate-200`}
                          >
                            {loanBalanceDisplay.text}
                          </span>
                        </td>
                        <td className="text-right">
                          <span
                            className={`${equityDisplay.className} text-slate-700 dark:text-slate-200`}
                          >
                            {equityDisplay.text}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(row.netCashFlow)}>
                            {netCashFlowDisplay.text}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={roeDisplay.className}>{roeDisplay.text}</span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {drillProperty ? (
          <div id="drilldown" className="ll_card ll_stack" style={{ gap: 12 }}>
            <div>
              <h2 className="text-base font-semibold">Net Cash Flow Breakdown</h2>
              <p className="ll_muted">
                {drillProperty.label} · {yearParam} ledger plus annual totals
              </p>
            </div>

            <div className="ll_table_wrap">
              <table className="ll_table ll_table_zebra w-full">
                <colgroup>
                  <col />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "160px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Type</th>
                    <th className="text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="text-center text-sm text-slate-600">
                        No cash flow activity for this property in {yearParam}.
                      </td>
                    </tr>
                  ) : (
                    drilldownRows.map((row) => (
                      <tr key={`${row.propertyId}-${row.categoryId}`}>
                        <td>
                          {row.parentCategoryName
                            ? `${row.parentCategoryName} > ${row.categoryName}`
                            : row.categoryName}
                        </td>
                        <td className="capitalize">{row.type}</td>
                        <td className="text-right">
                          <span className={amountClass(row.amount)}>
                            {formatCurrency(row.amount).text}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
