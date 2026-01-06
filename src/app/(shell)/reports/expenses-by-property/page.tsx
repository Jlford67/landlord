import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtMoney, propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getExpensesByProperty } from "@/lib/reports/expensesByProperty";

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

function moneyPositive(n: number) {
  const abs = Math.abs(n);
  return `$${fmtMoney(abs).replace(/[()]/g, "")}`;
}

function amountClass(n: number) {
  if (n < 0) return "text-red-600";
  if (n > 0) return "text-emerald-600";
  return "text-gray-700";
}

export default async function ExpensesByPropertyPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const user = await requireUser();

  const sp = (await searchParams) ?? {};

  const propertyIdRaw = getStr(sp, "propertyId");
  const propertyId = propertyIdRaw || null;
  const includeTransfersRaw = getStr(sp, "includeTransfers").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const parsedStart = parseDateUTC(getStr(sp, "start"));
  const parsedEnd = parseDateUTC(getStr(sp, "end"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

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

  const report = await getExpensesByProperty({
    userId: user.id,
    startDate,
    endDate,
    includeTransfers,
    propertyId,
  });

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
              <span className="ll_muted">Expenses by Property</span>
            </div>
            <h1>Expenses by Property</h1>
            <p className="ll_muted">
              Includes prorated annual expenses when applicable. Transfers are{" "}
              {includeTransfers ? "included" : "excluded"}.
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
              <label className="ll_label" htmlFor="propertyId">
                Property
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
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <button type="submit" className="ll_btn ll_btnPrimary" suppressHydrationWarning>
              Apply filters
            </button>
          </div>
        </form>

        <div className="ll_card ll_stack" style={{ gap: 12 }}>
          <div className="ll_rowBetween items-end">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Property totals</h2>
              <p className="ll_muted text-sm">
                Showing expenses from {formatInputDateUTC(startDate)} to{" "}
                {formatInputDateUTC(endDate)}.
              </p>
            </div>
          </div>

          <div className="ll_table_wrap">
            <table className="ll_table ll_table_zebra w-full table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "200px" }} />
                <col style={{ width: "160px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="!text-right">Annual expenses (prorated)</th>
                  <th className="!text-right">Total expenses</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-slate-600">
                      No expenses found for this range.
                    </td>
                  </tr>
                ) : (
                  <>
                    {report.rows.map((row) => (
                      <tr key={row.propertyId}>
                        <td>{row.propertyLabel}</td>
                        <td className="text-right">
                          <span className={amountClass(row.annualExpense)}>
                            {moneyPositive(row.annualExpense)}
                          </span>
                        </td>
                        <td className="text-right">
                          <span className={amountClass(row.totalExpense)}>
                            {moneyPositive(row.totalExpense)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </>
                )}
              </tbody>
              {report.rows.length === 0 ? null : (
                <tfoot>
                  <tr className="ll_table_total">
                    <td>Total</td>
                    <td className="text-right">
                      <span className={amountClass(report.totals.annualExpense)}>
                        {moneyPositive(report.totals.annualExpense)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={amountClass(report.totals.totalExpense)}>
                        {moneyPositive(report.totals.totalExpense)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
