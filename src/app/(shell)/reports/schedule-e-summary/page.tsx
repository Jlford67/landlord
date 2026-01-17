import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtMoney, propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getScheduleESummaryReport } from "@/lib/reports/scheduleESummary";
import Button from "@/components/ui/Button";
import { ArrowLeft, Download } from "lucide-react";
import LinkButton from "@/components/ui/LinkButton";

type SearchParams = Record<string, string | string[] | undefined>;

type Mode = "combined" | "transactionalOnly" | "annualOnly";

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

function moneyFromCents(cents: number) {
  return `$${fmtMoney(cents / 100)}`;
}

function amountClass(cents: number) {
  if (cents < 0) return "text-red-600";
  if (cents > 0) return "text-emerald-600";
  return "text-gray-700";
}

function rangeFromYear(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

export default async function ScheduleESummaryPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};

  const propertyIdRaw = getStr(sp, "propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;

  const includeTransfersRaw = getStr(sp, "includeTransfers").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const modeRaw = getStr(sp, "mode");
  const mode: Mode =
    modeRaw === "transactionalOnly" || modeRaw === "annualOnly" ? modeRaw : "combined";

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const yearParam = parseYear(getStr(sp, "year"));
  const startParam = parseDateUTC(getStr(sp, "start"));
  const endParam = parseDateUTC(getStr(sp, "end"));

  const baseRange = rangeFromYear(yearParam ?? currentYear);

  let startDate = yearParam ? baseRange.start : startParam ?? baseRange.start;
  let endDate = yearParam ? baseRange.end : endParam ?? baseRange.end;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const exportParams = new URLSearchParams();
  if (yearParam) exportParams.set("year", String(yearParam));
  exportParams.set("start", formatInputDateUTC(startDate));
  exportParams.set("end", formatInputDateUTC(endDate));
  exportParams.set("propertyId", propertyId ?? "all");
  exportParams.set("mode", mode);
  exportParams.set("includeTransfers", includeTransfers ? "1" : "0");
  const exportHref = `/api/exports/reports/schedule-e-summary?${exportParams.toString()}`;

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

  const report = await getScheduleESummaryReport({
    year: yearParam ?? undefined,
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId: propertyId ?? undefined,
    includeTransfers,
    mode,
  });

  const hasActivity =
    report.income.totalIncomeCents !== 0 || report.expenses.totalExpenseCents !== 0;
  const expenseTotals = report.expenses.buckets.reduce(
    (acc, bucket) => {
      acc.transactionalCents += bucket.transactionalCents;
      acc.annualCents += bucket.annualCents;
      acc.combinedCents += bucket.combinedCents;
      return acc;
    },
    { transactionalCents: 0, annualCents: 0, combinedCents: 0 }
  );

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        {/* Page header */}
        <div className="ll_card">
          <div className="ll_topbar">
            <div className="min-w-0">
              <div className="ll_breadcrumbs">
                <Link href="/reports" className="ll_link">
                  Reports
                </Link>
                <span className="ll_muted">/</span>
                <span className="ll_muted">Schedule E Summary</span>
              </div>

              <h1>Schedule E Summary</h1>

              <p className="ll_muted break-words">
                Schedule E-style rollup for tax and year-end. Transfers are{" "}
                {includeTransfers ? "included" : "excluded"}.
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

        <form className="ll_card ll_form" method="get">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            }}
          >
            <div>
              <label className="ll_label" htmlFor="year">
                Tax year (YYYY)
              </label>
              <input
                id="year"
                name="year"
                type="number"
                className="ll_input"
                defaultValue={yearParam ?? ""}
                placeholder={`${currentYear}`}
                suppressHydrationWarning
              />
              <p className="ll_muted text-xs mt-1">Year overrides custom dates.</p>
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
                defaultValue={formatInputDateUTC(startDate)}
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
                defaultValue={formatInputDateUTC(endDate)}
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="propertyId">
                Property
              </label>
              <select
                id="propertyId"
                name="propertyId"
                className="ll_input"
                defaultValue={propertyId ?? "all"}
                suppressHydrationWarning
              >
                <option value="all">All properties</option>
                {propertyOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="mode">
                Mode
              </label>
              <select
                id="mode"
                name="mode"
                className="ll_input"
                defaultValue={mode}
                suppressHydrationWarning
              >
                <option value="combined">Combined</option>
                <option value="transactionalOnly">Transactional only</option>
                <option value="annualOnly">Annual only</option>
              </select>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <input
                id="includeTransfers"
                name="includeTransfers"
                type="checkbox"
                value="1"
                defaultChecked={includeTransfers}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                suppressHydrationWarning
              />
              <label className="ll_label m-0" htmlFor="includeTransfers">
                Include transfers
              </label>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <Button type="submit" variant="warning" size="md" suppressHydrationWarning>
              Apply filters
            </Button>
          </div>

        </form>

        {!hasActivity ? (
          <div className="ll_card text-sm text-slate-600">
            No Schedule E activity found for this range.
          </div>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <div className="ll_card ll_stack" style={{ gap: 6 }}>
                <span className="ll_muted text-sm">Total income</span>
                <span
                  className={`text-lg font-semibold ${amountClass(
                    report.income.totalIncomeCents
                  )}`}
                >
                  {moneyFromCents(report.income.totalIncomeCents)}
                </span>
              </div>
              <div className="ll_card ll_stack" style={{ gap: 6 }}>
                <span className="ll_muted text-sm">Total expenses</span>
                <span
                  className={`text-lg font-semibold ${amountClass(
                    report.expenses.totalExpenseCents
                  )}`}
                >
                  {moneyFromCents(report.expenses.totalExpenseCents)}
                </span>
              </div>
              <div className="ll_card ll_stack" style={{ gap: 6 }}>
                <span className="ll_muted text-sm">Net income</span>
                <span className={`text-lg font-semibold ${amountClass(report.netCents)}`}>
                  {moneyFromCents(report.netCents)}
                </span>
              </div>
            </div>

            <div className="ll_card ll_stack" style={{ gap: 12 }}>
              <div className="ll_rowBetween items-end">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Income</h2>
                  <p className="ll_muted text-sm">
                    Showing {report.input.start} to {report.input.end}.
                  </p>
                </div>
              </div>
              <div className="ll_table_wrap">
                <table className="ll_table ll_table_zebra w-full table-fixed">
                  <colgroup>
                    <col />
                    <col style={{ width: "200px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Income type</th>
                      <th className="!text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Rents received</td>
                      <td className="text-right">
                        <span className={amountClass(report.income.rentsReceivedCents)}>
                          {moneyFromCents(report.income.rentsReceivedCents)}
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td>Other income</td>
                      <td className="text-right">
                        <span className={amountClass(report.income.otherIncomeCents)}>
                          {moneyFromCents(report.income.otherIncomeCents)}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr className="ll_table_total">
                      <td>Total income</td>
                      <td className="text-right">
                        <span className={amountClass(report.income.totalIncomeCents)}>
                          {moneyFromCents(report.income.totalIncomeCents)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <div className="ll_card ll_stack" style={{ gap: 12 }}>
              <div className="ll_rowBetween items-end">
                <div>
                  <h2 className="text-base font-semibold text-slate-900">Expenses</h2>
                  <p className="ll_muted text-sm">
                    Schedule E buckets, grouped by transactional vs annual totals.
                  </p>
                </div>
              </div>
              <div className="ll_table_wrap">
                <table className="ll_table ll_table_zebra w-full table-fixed">
                  <colgroup>
                    <col />
                    <col style={{ width: "180px" }} />
                    <col style={{ width: "180px" }} />
                    <col style={{ width: "180px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Expense bucket</th>
                      <th className="!text-right">Transactional</th>
                      <th className="!text-right">Annual</th>
                      <th className="!text-right">Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.expenses.buckets.map((bucket) => (
                      <tr key={bucket.key}>
                        <td>{bucket.label}</td>
                        <td className="text-right">
                          <span className={amountClass(bucket.transactionalCents)}>
                            {moneyFromCents(bucket.transactionalCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(bucket.annualCents)}>
                            {moneyFromCents(bucket.annualCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(bucket.combinedCents)}>
                            {moneyFromCents(bucket.combinedCents)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="ll_table_total">
                      <td>Total expenses</td>
                      <td className="text-right">
                        <span className={amountClass(expenseTotals.transactionalCents)}>
                          {moneyFromCents(expenseTotals.transactionalCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(expenseTotals.annualCents)}>
                          {moneyFromCents(expenseTotals.annualCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(expenseTotals.combinedCents)}>
                          {moneyFromCents(expenseTotals.combinedCents)}
                        </span>
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {report.byProperty ? (
              <div className="ll_card ll_stack" style={{ gap: 12 }}>
                <div className="ll_rowBetween items-end">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900">By Property</h2>
                    <p className="ll_muted text-sm">
                      Combined totals across all properties. Sorted by net income.
                    </p>
                  </div>
                </div>
                <div className="ll_table_wrap">
                  <table className="ll_table ll_table_zebra w-full table-fixed">
                    <colgroup>
                      <col />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "180px" }} />
                      <col style={{ width: "180px" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th className="!text-right">Income</th>
                        <th className="!text-right">Expenses</th>
                        <th className="!text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.byProperty.rows.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="text-center text-sm text-slate-600">
                            No property activity found.
                          </td>
                        </tr>
                      ) : (
                        report.byProperty.rows.map((row) => (
                          <tr key={row.propertyId}>
                            <td>{row.propertyLabel}</td>
                            <td className="text-right">
                              <span className={amountClass(row.incomeCents)}>
                                {moneyFromCents(row.incomeCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.expenseCents)}>
                                {moneyFromCents(row.expenseCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.netCents)}>
                                {moneyFromCents(row.netCents)}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="ll_table_total">
                        <td>Total</td>
                        <td className="text-right">
                          <span className={amountClass(report.byProperty.totals.incomeCents)}>
                            {moneyFromCents(report.byProperty.totals.incomeCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.byProperty.totals.expenseCents)}>
                            {moneyFromCents(report.byProperty.totals.expenseCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.byProperty.totals.netCents)}>
                            {moneyFromCents(report.byProperty.totals.netCents)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
