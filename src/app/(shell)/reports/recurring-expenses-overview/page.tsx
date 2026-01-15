import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { fmtMoney, propertyLabel } from "@/lib/format";
import { getRecurringExpensesOverviewReport } from "@/lib/reports/recurringExpensesOverview";
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

function moneyFromCents(cents: number) {
  return `$${fmtMoney(cents / 100)}`;
}

function amountClass(n: number) {
  if (n < 0) return "text-red-600";
  if (n > 0) return "text-emerald-600";
  return "text-gray-700";
}

function formatMissingMonths(months: string[]) {
  if (months.length === 0) return "—";
  const cap = 6;
  if (months.length <= cap) return months.join(", ");
  const prefix = months.slice(0, cap).join(", ");
  return `${prefix}, +${months.length - cap} more`;
}

export default async function RecurringExpensesOverviewPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};

  const propertyIdRaw = getStr(sp, "propertyId");
  const propertyId = propertyIdRaw === "all" ? "" : propertyIdRaw;
  const includeTransfersRaw = getStr(sp, "includeTransfers").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";
  const includeInactiveRaw = getStr(sp, "includeInactive").toLowerCase();
  const includeInactive = includeInactiveRaw === "1" || includeInactiveRaw === "true";
  const groupRaw = getStr(sp, "group");
  const group = groupRaw === "category" ? "category" : "property";

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

  const exportParams = new URLSearchParams();
  exportParams.set("propertyId", propertyId ?? "");
  exportParams.set("start", formatInputDateUTC(startDate));
  exportParams.set("end", formatInputDateUTC(endDate));
  exportParams.set("includeTransfers", includeTransfers ? "1" : "0");
  exportParams.set("includeInactive", includeInactive ? "1" : "0");
  exportParams.set("group", group);
  const exportHref = `/api/exports/reports/recurring-expenses-overview?${exportParams.toString()}`;

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

  const report = await getRecurringExpensesOverviewReport({
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId: propertyId || undefined,
    includeTransfers,
    includeInactive,
  });

  const rows = [...report.rows];
  rows.sort((a, b) => {
    if (group === "category") {
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      if (a.propertyLabel !== b.propertyLabel) return a.propertyLabel.localeCompare(b.propertyLabel);
      const memoA = a.memo ?? "";
      const memoB = b.memo ?? "";
      return memoA.localeCompare(memoB);
    }
    if (a.propertyLabel !== b.propertyLabel) return a.propertyLabel.localeCompare(b.propertyLabel);
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
    const memoA = a.memo ?? "";
    const memoB = b.memo ?? "";
    return memoA.localeCompare(memoB);
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
              <span className="ll_muted">Recurring Expenses Overview</span>
            </div>
            <h1>Recurring Expenses Overview</h1>
            <p className="ll_muted">
              Expected vs posted recurring expenses for the range, plus other expenses for context.
            </p>
          </div>
          <LinkButton href={exportHref} variant="outline" size="md">
            Export Excel
          </LinkButton>
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

            <div>
              <label className="ll_label" htmlFor="group">
                Grouping
              </label>
              <select
                id="group"
                name="group"
                className="ll_input"
                defaultValue={group}
                suppressHydrationWarning
              >
                <option value="property">Property first</option>
                <option value="category">Category first</option>
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

            <div className="flex items-center gap-2 pt-6">
              <input
                id="includeInactive"
                name="includeInactive"
                type="checkbox"
                value="1"
                defaultChecked={includeInactive}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                suppressHydrationWarning
              />
              <label className="ll_label m-0" htmlFor="includeInactive">
                Include inactive recurring rules
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
              <h2 className="text-base font-semibold text-slate-900">Recurring totals</h2>
              <p className="ll_muted text-sm">
                Showing {formatInputDateUTC(startDate)} to {formatInputDateUTC(endDate)}. Transfers are{" "}
                {includeTransfers ? "included" : "excluded"}.
              </p>
            </div>
            <div className="text-right text-sm">
              <div>
                <span className="ll_muted mr-2">Expected</span>
                <span className={amountClass(report.totals.expectedTotalCents)}>
                  {moneyFromCents(report.totals.expectedTotalCents)}
                </span>
              </div>
              <div>
                <span className="ll_muted mr-2">Posted</span>
                <span className={amountClass(report.totals.postedTotalCents)}>
                  {moneyFromCents(report.totals.postedTotalCents)}
                </span>
              </div>
              <div>
                <span className="ll_muted mr-2">Variance</span>
                <span className={amountClass(report.totals.varianceCents)}>
                  {moneyFromCents(report.totals.varianceCents)}
                </span>
              </div>
            </div>
          </div>

          <div className="ll_table_wrap">
            <table className="ll_table ll_table_zebra w-full table-fixed">
              <colgroup>
                <col />
                <col />
                <col />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "120px" }} />
                <col style={{ width: "200px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Property</th>
                  <th>Category</th>
                  <th>Memo</th>
                  <th className="!text-right">Monthly</th>
                  <th className="!text-right">Months</th>
                  <th className="!text-right">Expected</th>
                  <th className="!text-right">Posted</th>
                  <th className="!text-right">Variance</th>
                  <th>Missing months</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-sm text-slate-600">
                      No recurring expenses found for this range.
                    </td>
                  </tr>
                ) : (
                  rows.map((row) => (
                    <tr key={row.recurringTransactionId}>
                      <td>{row.propertyLabel}</td>
                      <td>{row.categoryName}</td>
                      <td className="truncate">{row.memo || "(no memo)"}</td>
                      <td className="text-right">
                        <span className={amountClass(row.monthlyAmountCents)}>
                          {moneyFromCents(row.monthlyAmountCents)}
                        </span>
                      </td>
                      <td className="text-right">{row.monthsInRange.length}</td>
                      <td className="text-right">
                        <span className={amountClass(row.expectedTotalCents)}>
                          {moneyFromCents(row.expectedTotalCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(row.postedTotalCents)}>
                          {moneyFromCents(row.postedTotalCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(row.varianceCents)}>
                          {moneyFromCents(row.varianceCents)}
                        </span>
                      </td>
                      <td>
                        <div className="text-xs text-slate-600">
                          {row.missingMonths.length ? `${row.missingMonths.length} missing` : "On track"}
                        </div>
                        <div className="text-xs text-slate-500 truncate">{formatMissingMonths(row.missingMonths)}</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length === 0 ? null : (
                <tfoot>
                  <tr className="ll_table_total">
                    <td colSpan={5}>Totals</td>
                    <td className="text-right">
                      <span className={amountClass(report.totals.expectedTotalCents)}>
                        {moneyFromCents(report.totals.expectedTotalCents)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={amountClass(report.totals.postedTotalCents)}>
                        {moneyFromCents(report.totals.postedTotalCents)}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className={amountClass(report.totals.varianceCents)}>
                        {moneyFromCents(report.totals.varianceCents)}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <div className="ll_card">
          <div className="ll_rowBetween items-start">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Other expenses in range</h3>
              <p className="ll_muted text-sm">
                Excludes recurring postings above and prorates annual category expenses across the dates.
              </p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Other transactional expenses</div>
              <div className={`text-lg font-semibold ${amountClass(report.otherTotals.otherTransactionalExpenseCents)}`}>
                {moneyFromCents(report.otherTotals.otherTransactionalExpenseCents)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">Annual (non-recurring) expenses</div>
              <div className={`text-lg font-semibold ${amountClass(report.otherTotals.annualExpenseCents)}`}>
                {moneyFromCents(report.otherTotals.annualExpenseCents)}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div className="text-xs uppercase tracking-wide text-slate-500">All expenses in range</div>
              <div className={`text-lg font-semibold ${amountClass(report.otherTotals.allExpenseCents)}`}>
                {moneyFromCents(report.otherTotals.allExpenseCents)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
