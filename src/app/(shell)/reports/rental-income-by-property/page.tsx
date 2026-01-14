import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  endExclusive,
  getRentalIncomeByPropertyReport,
  isRentalIncomeCategory,
  prorateAnnualForRange,
} from "@/lib/reports/rentalIncomeByProperty";

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
  return new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));
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

type DrillBucket = "total" | "annual" | "transactional";

function parseDrillBucket(value: string): DrillBucket {
  if (value === "annual" || value === "transactional" || value === "total") {
    return value;
  }
  return "total";
}

function buildReportQuery(params: {
  propertyId: string | null;
  startDate: Date;
  endDate: Date;
  includeTransfers: boolean;
  includeOtherIncome: boolean;
  drillPropertyId?: string | null;
  drillBucket?: DrillBucket;
}) {
  const query = new URLSearchParams();
  query.set("propertyId", params.propertyId ?? "all");
  query.set("start", formatInputDateUTC(params.startDate));
  query.set("end", formatInputDateUTC(params.endDate));
  if (params.includeTransfers) query.set("includeTransfers", "1");
  if (params.includeOtherIncome) query.set("includeOtherIncome", "1");
  if (params.drillPropertyId) query.set("drillPropertyId", params.drillPropertyId);
  if (params.drillBucket) query.set("drillBucket", params.drillBucket);
  return query.toString();
}

export default async function RentalIncomeByPropertyPage({
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
  const includeOtherIncomeRaw = getStr(sp, "includeOtherIncome").toLowerCase();
  const includeOtherIncome =
    includeOtherIncomeRaw === "1" || includeOtherIncomeRaw === "true";

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

  const result = await getRentalIncomeByPropertyReport({
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId,
    includeTransfers,
    includeOtherIncome,
  });

  const drillPropertyId = getStr(sp, "drillPropertyId") || null;
  const drillBucket = parseDrillBucket(getStr(sp, "drillBucket"));
  const drillTarget = drillPropertyId
    ? result.rows.find((row) => row.propertyId === drillPropertyId) ?? null
    : null;

  const exportParams = new URLSearchParams();
  exportParams.set("propertyId", propertyId ?? "all");
  exportParams.set("start", formatInputDateUTC(startDate));
  exportParams.set("end", formatInputDateUTC(endDate));
  exportParams.set("includeTransfers", includeTransfers ? "1" : "0");
  exportParams.set("includeOtherIncome", includeOtherIncome ? "1" : "0");
  if (drillPropertyId) exportParams.set("drillPropertyId", drillPropertyId);
  if (drillBucket) exportParams.set("drillBucket", drillBucket);
  const exportHref = `/api/exports/reports/rental-income-by-property?${exportParams.toString()}`;


  type DrilldownRow = {
    id: string;
    type: "ledger" | "annual";
    period: string;
    sortKey: string;
    dateLabel: string;
    category: string;
    description: string;
    amount: number;
  };

  let drilldownRows: DrilldownRow[] = [];
  let drilldownTotal = 0;

  if (drillTarget) {
    const allowedCategoryTypes = includeTransfers ? ["income", "transfer"] : ["income"];
    const endDateExclusive = endExclusive(endDate);

    const ledgerTxns = await prisma.transaction.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endDateExclusive,
        },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        payee: true,
        memo: true,
        category: { select: { name: true, type: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const ledgerRows: DrilldownRow[] = ledgerTxns
      .map((txn) => {
        const category = txn.category;
        if (!category) return null;

        const isIncomeLike =
          category.type === "income" || (includeTransfers && category.type === "transfer");
        if (!isIncomeLike) return null;

        const isRentalCategory =
          category.type === "income" && isRentalIncomeCategory(category.name);
        if (!includeOtherIncome && !isRentalCategory) return null;

        const rawAmount = Number(txn.amount ?? 0);
        const normalizedAmount = rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;
        if (drillBucket === "annual") return null;
        drilldownTotal += normalizedAmount;
        const year = txn.date.getUTCFullYear();
        const month = String(txn.date.getUTCMonth() + 1).padStart(2, "0");
        const day = String(txn.date.getUTCDate()).padStart(2, "0");
        return {
          id: txn.id,
          type: "ledger",
          period: formatMonthYearUTC(txn.date),
          sortKey: `${year}-${month}-${day}`,
          dateLabel: formatInputDateUTC(txn.date),
          category: category.name,
          description: txn.payee || txn.memo || "-",
          amount: normalizedAmount,
        };
      })
      .filter((row): row is DrilldownRow => Boolean(row));

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        year: { gte: startYear, lte: endYear },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        year: true,
        amount: true,
        note: true,
        category: { select: { name: true, type: true } },
      },
      orderBy: [{ year: "asc" }, { id: "asc" }],
    });

    const annualDetailRows: DrilldownRow[] = annualRows
      .map((row) => {
        const category = row.category;
        if (!category) return null;

        const isIncomeLike =
          category.type === "income" || (includeTransfers && category.type === "transfer");
        if (!isIncomeLike) return null;

        const isRentalCategory =
          category.type === "income" && isRentalIncomeCategory(category.name);
        if (!includeOtherIncome && !isRentalCategory) return null;

        const baseAmount = Number(row.amount ?? 0);
        const normalizedAmount = baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;
        const prorated = prorateAnnualForRange(
          row.year,
          normalizedAmount,
          startDate,
          endDate
        );
        if (prorated === 0) return null;
        if (drillBucket === "transactional") return null;
        drilldownTotal += prorated;
        return {
          id: row.id,
          type: "annual",
          period: `${row.year} (Annual)`,
          sortKey: `${row.year}-00-00`,
          dateLabel: "",
          category: category.name,
          description: row.note?.trim() || "Annual amount (prorated)",
          amount: prorated,
        };
      })
      .filter((row): row is DrilldownRow => Boolean(row));

    drilldownRows = [...annualDetailRows, ...ledgerRows];
    drilldownRows.sort((a, b) => {
      if (a.sortKey !== b.sortKey) return a.sortKey.localeCompare(b.sortKey);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.description.localeCompare(b.description);
    });
  }

  const drilldownTargetTotal = drillTarget
    ? drillBucket === "annual"
      ? drillTarget.annualIncomeCents
      : drillBucket === "transactional"
        ? drillTarget.transactionalIncomeCents
        : drillTarget.totalIncomeCents
    : 0;
  const drilldownDifference = drillTarget ? drilldownTotal - drilldownTargetTotal : 0;

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
              <span className="ll_muted">Rental Income by Property</span>
            </div>
            <h1>Rental Income by Property</h1>
            <p className="ll_muted">
              Combined ledger and annual rental income by property within the selected range.
              Transfers are {includeTransfers ? "included" : "excluded"}.{" "}
              {includeOtherIncome
                ? "All income categories are included."
                : "Only rental income categories are counted."}
            </p>
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

            <div className="flex items-center gap-2 pt-6">
              <input
                id="includeOtherIncome"
                name="includeOtherIncome"
                type="checkbox"
                value="1"
                defaultChecked={includeOtherIncome}
                className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                suppressHydrationWarning
              />
              <label className="ll_label m-0" htmlFor="includeOtherIncome">
                Include other income categories
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
                Showing rental income from {formatInputDateUTC(startDate)} to{" "}
                {formatInputDateUTC(endDate)}.
              </p>
            </div>
          </div>

          <div className="ll_table_wrap">
            <table className="ll_table ll_table_zebra w-full table-fixed">
              <colgroup>
                <col />
                <col style={{ width: "200px" }} />
                <col style={{ width: "200px" }} />
                <col style={{ width: "200px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Property</th>
                  <th className="!text-right">Transactional rental income</th>
                  <th className="!text-right">Annual prorated rental income</th>
                  <th className="!text-right">Total rental income</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-slate-600">
                      No rental income found for this range.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row) => (
                    <tr key={row.propertyId}>
                      <td>{row.propertyLabel}</td>
                      <td className="text-right">
                        <span className={amountClass(row.transactionalIncomeCents)}>
                          {moneyAccounting(row.transactionalIncomeCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/reports/rental-income-by-property?${buildReportQuery({
                            propertyId,
                            startDate,
                            endDate,
                            includeTransfers,
                            includeOtherIncome,
                            drillPropertyId: row.propertyId,
                            drillBucket: "annual",
                          })}`}
                          className={`cursor-pointer inline-flex justify-end hover:underline underline-offset-2 ${amountClass(
                            row.annualIncomeCents
                          )}`}
                        >
                          {moneyAccounting(row.annualIncomeCents)}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/reports/rental-income-by-property?${buildReportQuery({
                            propertyId,
                            startDate,
                            endDate,
                            includeTransfers,
                            includeOtherIncome,
                            drillPropertyId: row.propertyId,
                            drillBucket: "total",
                          })}`}
                          className={`cursor-pointer inline-flex justify-end hover:underline underline-offset-2 ${amountClass(
                            row.totalIncomeCents
                          )}`}
                        >
                          {moneyAccounting(row.totalIncomeCents)}
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="ll_table_total">
                  <td>Total</td>
                  <td className="text-right">
                    <span className={amountClass(result.totals.transactionalIncomeCents)}>
                      {moneyAccounting(result.totals.transactionalIncomeCents)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className={amountClass(result.totals.annualIncomeCents)}>
                      {moneyAccounting(result.totals.annualIncomeCents)}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className={amountClass(result.totals.totalIncomeCents)}>
                      {moneyAccounting(result.totals.totalIncomeCents)}
                    </span>
                  </td>
                </tr>
              </tfoot>
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
                Bucket:{" "}
                {drillBucket === "annual"
                  ? "Annual prorated rental income"
                  : drillBucket === "transactional"
                    ? "Transactional rental income"
                    : "Total rental income"}{" "}
                · {formatInputDateUTC(startDate)} to {formatInputDateUTC(endDate)} ·
                Transfers {includeTransfers ? "included" : "excluded"} · Other income{" "}
                {includeOtherIncome ? "included" : "excluded"}.
              </p>
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
                            {moneyAccounting(row.amount)}
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
                      <span className={amountClass(drilldownTargetTotal)}>
                        {moneyAccounting(drilldownTargetTotal)}
                      </span>
                    </td>
                  </tr>
                  {Math.abs(drilldownDifference) > 0.01 ? (
                    <tr>
                      <td colSpan={5} className="text-right text-xs text-slate-500">
                        Rounding difference: {moneyAccounting(drilldownDifference)}
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
