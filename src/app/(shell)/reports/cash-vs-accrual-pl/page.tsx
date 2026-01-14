import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getCashVsAccrualPLReport } from "@/lib/reports/cashVsAccrualPL";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function parseDateUTC(value?: string): Date | null {
  if (!value) return null;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
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

export default async function CashVsAccrualPLPage({
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
  const viewRaw = getStr(sp, "view");
  const view = viewRaw === "byCategory" ? "byCategory" : "summary";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const parsedStart = parseDateUTC(getStr(sp, "start"));
  const parsedEnd = parseDateUTC(getStr(sp, "end"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const exportParams = new URLSearchParams();
  exportParams.set("propertyId", propertyId ?? "all");
  exportParams.set("start", formatInputDateUTC(startDate));
  exportParams.set("end", formatInputDateUTC(endDate));
  exportParams.set("includeTransfers", includeTransfers ? "1" : "0");
  exportParams.set("view", view);
  const exportHref = `/api/exports/reports/cash-vs-accrual-pl?${exportParams.toString()}`;

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

  const report = await getCashVsAccrualPLReport({
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId,
    includeTransfers,
    view,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        <div className="ll_rowBetween items-start gap-3">
          <div className="ll_stack" style={{ gap: 4 }}>
            <div className="ll_breadcrumbs">
              <Link href="/reports" className="ll_link">
                Reports
              </Link>
              <span className="ll_muted">/</span>
              <span className="ll_muted">Cash vs Accrual P&amp;L</span>
            </div>
            <h1>Cash vs Accrual P&amp;L</h1>
            <p className="ll_muted">
              Compare profit &amp; loss totals on cash and accrual bases for the selected
              range. Transfers are {includeTransfers ? "included" : "excluded"}.
            </p>
            {report.input.accrualMode === "fallback" ? (
              <p className="text-sm text-slate-500">
                Accrual dates aren&apos;t tracked yet; accrual totals match cash totals.
              </p>
            ) : null}
          </div>
           <a className="ll_btn" href={exportHref}>
            Export Excel
          </a>
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
              <label className="ll_label" htmlFor="start">
                Start date
              </label>
              <input
                id="start"
                name="start"
                type="date"
                className="ll_input"
                defaultValue={formatInputDateUTC(startDate)}
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
                defaultValue={formatInputDateUTC(endDate)}
                required
                suppressHydrationWarning
              />
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

            <div>
              <label className="ll_label" htmlFor="view">
                View
              </label>
              <select
                id="view"
                name="view"
                className="ll_input"
                defaultValue={view}
                suppressHydrationWarning
              >
                <option value="summary">Summary</option>
                <option value="byCategory">By category</option>
              </select>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <button type="submit" className="ll_btn ll_btnPrimary" suppressHydrationWarning>
              Apply filters
            </button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="ll_rowBetween items-center">
              <div className="text-sm font-semibold text-slate-900">Cash basis</div>
              <span className="ll_badge">Cash</span>
            </div>
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Income</span>
                <span className={amountClass(report.cash.totals.incomeCents)}>
                  {moneyAccounting(report.cash.totals.incomeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Expenses</span>
                <span className={amountClass(report.cash.totals.expenseCents)}>
                  {moneyAccounting(report.cash.totals.expenseCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Net</span>
                <span className={amountClass(report.cash.totals.netCents)}>
                  {moneyAccounting(report.cash.totals.netCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="ll_rowBetween items-center">
              <div className="text-sm font-semibold text-slate-900">Accrual basis</div>
              <span className="ll_badge">Accrual</span>
            </div>
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Income</span>
                <span className={amountClass(report.accrual.totals.incomeCents)}>
                  {moneyAccounting(report.accrual.totals.incomeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Expenses</span>
                <span className={amountClass(report.accrual.totals.expenseCents)}>
                  {moneyAccounting(report.accrual.totals.expenseCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Net</span>
                <span className={amountClass(report.accrual.totals.netCents)}>
                  {moneyAccounting(report.accrual.totals.netCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="text-sm font-semibold text-slate-900">Delta (Accrual - Cash)</div>
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Income delta</span>
                <span className={amountClass(report.delta.incomeCents)}>
                  {moneyAccounting(report.delta.incomeCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="ll_muted">Expense delta</span>
                <span className={amountClass(report.delta.expenseCents)}>
                  {moneyAccounting(report.delta.expenseCents)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Net delta</span>
                <span className={amountClass(report.delta.netCents)}>
                  {moneyAccounting(report.delta.netCents)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {view === "byCategory" ? (
          <div className="ll_stack" style={{ gap: 16 }}>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className="ll_card ll_stack" style={{ gap: 12 }}>
                <div className="ll_rowBetween items-center">
                  <h2 className="text-base font-semibold text-slate-900">Cash basis</h2>
                  <span className="ll_badge">Cash</span>
                </div>
                <div className="ll_table_wrap">
                  <table className="ll_table ll_table_zebra w-full table-fixed">
                    <colgroup>
                      <col />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="text-left">Category</th>
                        <th className="!text-right">Income</th>
                        <th className="!text-right">Expenses</th>
                        <th className="!text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cash.byCategory && report.cash.byCategory.length > 0 ? (
                        report.cash.byCategory.map((row) => (
                          <tr key={row.categoryId}>
                            <td>{row.categoryName}</td>
                            <td className="text-right">
                              <span className={amountClass(row.incomeCents)}>
                                {moneyAccounting(row.incomeCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.expenseCents)}>
                                {moneyAccounting(row.expenseCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.netCents)}>
                                {moneyAccounting(row.netCents)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center text-sm text-slate-600">
                            No cash-basis data for this range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="ll_table_total">
                        <td>Total</td>
                        <td className="text-right">
                          <span className={amountClass(report.cash.totals.incomeCents)}>
                            {moneyAccounting(report.cash.totals.incomeCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.cash.totals.expenseCents)}>
                            {moneyAccounting(report.cash.totals.expenseCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.cash.totals.netCents)}>
                            {moneyAccounting(report.cash.totals.netCents)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="ll_card ll_stack" style={{ gap: 12 }}>
                <div className="ll_rowBetween items-center">
                  <h2 className="text-base font-semibold text-slate-900">Accrual basis</h2>
                  <span className="ll_badge">Accrual</span>
                </div>
                <div className="ll_table_wrap">
                  <table className="ll_table ll_table_zebra w-full table-fixed">
                    <colgroup>
                      <col />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                      <col style={{ width: "22%" }} />
                    </colgroup>
                    <thead>
                      <tr>
                        <th className="text-left">Category</th>
                        <th className="!text-right">Income</th>
                        <th className="!text-right">Expenses</th>
                        <th className="!text-right">Net</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.accrual.byCategory && report.accrual.byCategory.length > 0 ? (
                        report.accrual.byCategory.map((row) => (
                          <tr key={row.categoryId}>
                            <td>{row.categoryName}</td>
                            <td className="text-right">
                              <span className={amountClass(row.incomeCents)}>
                                {moneyAccounting(row.incomeCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.expenseCents)}>
                                {moneyAccounting(row.expenseCents)}
                              </span>
                            </td>
                            <td className="text-right">
                              <span className={amountClass(row.netCents)}>
                                {moneyAccounting(row.netCents)}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center text-sm text-slate-600">
                            No accrual-basis data for this range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr className="ll_table_total">
                        <td>Total</td>
                        <td className="text-right">
                          <span className={amountClass(report.accrual.totals.incomeCents)}>
                            {moneyAccounting(report.accrual.totals.incomeCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.accrual.totals.expenseCents)}>
                            {moneyAccounting(report.accrual.totals.expenseCents)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(report.accrual.totals.netCents)}>
                            {moneyAccounting(report.accrual.totals.netCents)}
                          </span>
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
