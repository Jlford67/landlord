import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getProfitLossByProperty } from "@/lib/reports/profitLossByProperty";
import { ArrowLeft, Download } from "lucide-react";
import Button from "@/components/ui/Button";
import LinkButton from "@/components/ui/LinkButton";

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

export default async function ProfitLossReportPage({
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
  const exportHref = `/api/exports/reports/profit-loss?${exportParams.toString()}`;

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

  const result = await getProfitLossByProperty({
    propertyId,
    startDate,
    endDate,
    includeTransfers,
    includeAnnualTotals,
  });

  const propertyOrder: string[] = [];
  for (const row of result.rows) {
    if (!propertyOrder.includes(row.propertyId)) {
      propertyOrder.push(row.propertyId);
    }
  }

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        {/* Page header */}
        <div className="ll_card" style={{ marginBottom: 14 }}>
          <div className="ll_topbar" style={{ marginBottom: 0 }}>
            <div className="ll_rowBetween items-start gap-3">
              <div className="ll_stack min-w-0 flex-1" style={{ gap: 4 }}>
                <div className="ll_breadcrumbs">
                  <Link href="/reports" className="ll_link">
                    Reports
                  </Link>
                  <span className="ll_muted">/</span>
                  <span className="ll_muted">Profit &amp; Loss by Property</span>
                </div>

                <h1>Profit &amp; Loss by Property</h1>

                <p className="ll_muted break-words">
                  Ledger transactions and annual totals within the selected date range (annual amounts
                  are prorated when the range covers only part of a year). Transfers are{" "}
                  {includeTransfers ? "included" : "excluded"}.
                </p>
              </div>

              <div className="ll_topbarRight flex flex-wrap items-center gap-2 shrink-0 justify-end">
                <LinkButton
                  href="/reports"
                  variant="outline"
                  size="md"
                  leftIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Back
                </LinkButton>

                <form action={exportHref} method="get">
                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    leftIcon={<Download className="h-4 w-4" />}
                  >
                    Export Excel
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
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
            <Button type="submit" variant="warning" size="md" suppressHydrationWarning>
              Apply filters
            </Button>
          </div>
        </form>

        <div className="mt-6 ll_table_wrap">
          <table className="ll_table ll_table_zebra w-full">
            <colgroup>
              <col />
              <col />
              <col />
              <col style={{ width: "160px" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Property</th>
                <th>Category</th>
                <th>Type</th>
                <th className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center text-sm text-slate-600">
                    No transactions found for this range.
                  </td>
                </tr>
              ) : (
                propertyOrder.map((pid) =>
                  result.rows
                    .filter((r) => r.propertyId === pid)
                    .map((row) => (
                      <tr key={`${row.propertyId}-${row.categoryId}`}>
                        <td>{row.propertyName}</td>
                        <td>
                          {row.parentCategoryName
                            ? `${row.parentCategoryName} > ${row.categoryName}`
                            : row.categoryName}
                        </td>
                        <td className="capitalize">{row.type}</td>
                        <td className="text-right">
                          <span className={amountClass(row.amount)}>
                            {moneyAccounting(row.amount)}
                          </span>
                        </td>
                      </tr>
                    ))
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-6 ll_table_wrap">
          <table className="ll_table ll_table_zebra w-full table-fixed">
            <colgroup>
              <col style={{ width: "55%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead>
              <tr>
                <th>Property</th>
                <th className="!text-right">Income total</th>
                <th className="!text-right">Expense total</th>
                <th className="!text-right">Net total</th>
              </tr>
            </thead>
            <tbody>
              {propertyOrder.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-sm text-slate-600">
                    No totals to show.
                  </td>
                </tr>
              ) : (
                propertyOrder.map((pid) => {
                  const totals = result.subtotalsByProperty[pid];
                  if (!totals) return null;
                  return (
                    <tr key={pid}>
                      <td>{totals.propertyName}</td>
                      <td className="text-right">
                        <span className={amountClass(totals.incomeTotal)}>
                          {moneyAccounting(totals.incomeTotal)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(totals.expenseTotal)}>
                          {moneyAccounting(totals.expenseTotal)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(totals.netTotal)}>
                          {moneyAccounting(totals.netTotal)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
              <tr className="ll_table_total">
                <td>Grand totals</td>
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
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
