import Link from "next/link";
import { prisma } from "@/lib/db";
import { fmtMoney, propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  addDaysUTC,
  calculateProratedAnnualExpense,
  getExpensesByProperty,
} from "@/lib/reports/expensesByProperty";
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

function formatMonthYearUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${m}-${y}`;
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

function buildReportQuery(params: {
  propertyId: string | null;
  startDate: Date;
  endDate: Date;
  includeTransfers: boolean;
  drillPropertyId?: string | null;
}) {
  const query = new URLSearchParams();
  if (params.propertyId) query.set("propertyId", params.propertyId);
  query.set("start", formatInputDateUTC(params.startDate));
  query.set("end", formatInputDateUTC(params.endDate));
  if (params.includeTransfers) query.set("includeTransfers", "1");
  if (params.drillPropertyId) query.set("drillPropertyId", params.drillPropertyId);
  return query.toString();
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

  const exportParams = new URLSearchParams();
  if (propertyId) exportParams.set("propertyId", propertyId);
  exportParams.set("start", formatInputDateUTC(startDate));
  exportParams.set("end", formatInputDateUTC(endDate));
  exportParams.set("includeTransfers", includeTransfers ? "1" : "0");
  const drillPropertyIdParam = getStr(sp, "drillPropertyId");
  if (drillPropertyIdParam) exportParams.set("drillPropertyId", drillPropertyIdParam);
  const exportHref = `/api/exports/reports/expenses-by-property?${exportParams.toString()}`;

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

  const drillPropertyId = getStr(sp, "drillPropertyId") || null;
  const drillTarget = drillPropertyId
    ? report.rows.find((row) => row.propertyId === drillPropertyId) ?? null
    : null;

  type DrilldownRow = {
    id: string;
    type: "ledger" | "annual";
    period: string;
    sortKey: string;
    date: Date | null;
    dateLabel: string;
    category: string;
    description: string;
    amount: number;
  };

  let drilldownRows: DrilldownRow[] = [];
  let annualSubtotal = 0;
  let ledgerSubtotal = 0;

  if (drillTarget) {
    const endExclusive = addDaysUTC(endDate, 1);
    const allowedCategoryTypes = includeTransfers ? ["expense", "transfer"] : ["expense"];

    const ledgerTxns = await prisma.transaction.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        deletedAt: null,
        amount: { lt: 0 },
        date: {
          gte: startDate,
          lt: endExclusive,
        },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        payee: true,
        memo: true,
        category: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const ledgerRows: DrilldownRow[] = ledgerTxns.map((txn) => {
      const year = txn.date.getUTCFullYear();
      const month = String(txn.date.getUTCMonth() + 1).padStart(2, "0");
      const description = txn.payee || txn.memo || "-";
      ledgerSubtotal += txn.amount;
      return {
        id: txn.id,
        type: "ledger",
        period: formatMonthYearUTC(txn.date),
        sortKey: `${year}-${month}`,
        date: txn.date,
        dateLabel: formatInputDateUTC(txn.date),
        category: txn.category.name,
        description,
        amount: txn.amount,
      };
    });

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        year: { gte: startYear, lte: endYear },
        category: { type: "expense" },
      },
      select: {
        id: true,
        year: true,
        amount: true,
        note: true,
        category: { select: { name: true } },
      },
    });

    const annualDetailRows: DrilldownRow[] = annualRows
      .map((row) => {
        const prorated = calculateProratedAnnualExpense({
          amount: Number(row.amount ?? 0),
          year: row.year,
          startDate,
          endDate,
        });
        if (prorated === 0) return null;
        annualSubtotal += prorated;
        return {
          id: row.id,
          type: "annual",
          period: `${row.year} (Annual)`,
          sortKey: `${row.year}-00`,
          date: null,
          dateLabel: "—",
          category: row.category.name,
          description: row.note?.trim() || "Annual amount (prorated)",
          amount: prorated,
        };
      })
      .filter((row): row is DrilldownRow => Boolean(row));

    drilldownRows = [...annualDetailRows, ...ledgerRows];
    drilldownRows.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return 1;
      if (b.date) return -1;
      return a.description.localeCompare(b.description);
    });
  }

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
                          <Link
                            href={`/reports/expenses-by-property?${buildReportQuery({
                              propertyId,
                              startDate,
                              endDate,
                              includeTransfers,
                              drillPropertyId: row.propertyId,
                            })}`}
                            className={`cursor-pointer inline-flex justify-end hover:underline underline-offset-2 ${amountClass(
                              row.annualExpense
                            )}`}
                          >
                            {moneyPositive(row.annualExpense)}
                          </Link>
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

        {drillTarget ? (
          <div className="ll_card ll_stack" style={{ gap: 12 }}>
            <div className="ll_stack" style={{ gap: 4 }}>
              <h2 className="text-base font-semibold text-slate-900">
                Details for {drillTarget.propertyLabel}
              </h2>
              <p className="ll_muted text-sm">
                {formatInputDateUTC(startDate)} to {formatInputDateUTC(endDate)} · Transfers{" "}
                {includeTransfers ? "included" : "excluded"}.
              </p>
              {ledgerSubtotal !== 0 ? (
                <p className="ll_muted text-xs">
                  Ledger expenses in range: {moneyPositive(ledgerSubtotal)}
                </p>
              ) : null}
            </div>

            <div className="ll_table_wrap">
              <table className="ll_table ll_table_zebra w-full table-fixed">
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "180px" }} />
                  <col />
                  <col style={{ width: "150px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th className="!text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center text-sm text-slate-600">
                        No drill-down details available for this property.
                      </td>
                    </tr>
                  ) : (
                    drilldownRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`}>
                        <td>{row.period}</td>
                        <td>{row.dateLabel}</td>
                        <td>{row.category}</td>
                        <td className="truncate">{row.description}</td>
                        <td className="text-right">
                          <span className={amountClass(row.amount)}>
                            {moneyPositive(row.amount)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr className="ll_table_total">
                    <td colSpan={4}>Total (drill-down)</td>
                    <td className="text-right">
                      <span className={amountClass(drillTarget.annualExpense)}>
                        {moneyPositive(drillTarget.annualExpense)}
                      </span>
                    </td>
                  </tr>
                  {Math.abs(annualSubtotal - drillTarget.annualExpense) > 0.01 ? (
                    <tr>
                      <td colSpan={5} className="text-right text-xs text-slate-500">
                        Rounding difference: {moneyPositive(annualSubtotal - drillTarget.annualExpense)}
                      </td>
                    </tr>
                  ) : null}
                </tfoot>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
