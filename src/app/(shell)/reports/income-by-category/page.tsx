import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  endExclusive,
  getIncomeByCategoryReport,
  prorateAnnualForRange,
  toYmd,
} from "@/lib/reports/incomeByCategory";

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
  drillCategoryId?: string | null;
  drillBucket?: DrillBucket;
}) {
  const query = new URLSearchParams();
  query.set("propertyId", params.propertyId ?? "all");
  query.set("start", formatInputDateUTC(params.startDate));
  query.set("end", formatInputDateUTC(params.endDate));
  if (params.includeTransfers) query.set("includeTransfers", "1");
  if (params.drillCategoryId) query.set("drillCategoryId", params.drillCategoryId);
  if (params.drillBucket) query.set("drillBucket", params.drillBucket);
  return query.toString();
}

export default async function IncomeByCategoryPage({
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
if (propertyId) exportParams.set("propertyId", propertyId);
exportParams.set("start", formatInputDateUTC(startDate));
exportParams.set("end", formatInputDateUTC(endDate));
exportParams.set("includeTransfers", includeTransfers ? "true" : "false");

const exportHref = `/api/exports/reports/income-by-category?${exportParams.toString()}`;


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

  const result = await getIncomeByCategoryReport({
    start: toYmd(startDate),
    end: toYmd(endDate),
    propertyId,
    includeTransfers,
  });

  const drillCategoryId = getStr(sp, "drillCategoryId") || null;
  const drillBucket = parseDrillBucket(getStr(sp, "drillBucket"));
  const drillTarget = drillCategoryId
    ? result.rows.find((row) => row.categoryId === drillCategoryId) ?? null
    : null;

  type DrilldownRow = {
    id: string;
    type: "ledger" | "annual";
    period: string;
    sortKey: string;
    dateLabel: string;
    category: string;
    description: string;
    propertyLabel?: string;
    amount: number;
  };

  const propertyLabelMap = new Map(properties.map((p) => [p.id, propertyLabel(p)]));
  const propertyScopeLabel = propertyId
    ? propertyLabelMap.get(propertyId) ?? "Selected property"
    : "All properties";

  let drilldownRows: DrilldownRow[] = [];
  let drilldownTotal = 0;

  if (drillTarget) {
    const allowedTypes = includeTransfers ? ["income", "transfer"] : ["income"];
    const category = await prisma.category.findFirst({
      where: { id: drillTarget.categoryId, type: { in: allowedTypes } },
      select: { id: true, name: true, type: true },
    });

    if (category) {
      const endDateExclusive = endExclusive(endDate);

      const transactionSelect = {
        id: true,
        date: true,
        amount: true,
        payee: true,
        memo: true,
        category: { select: { name: true, type: true } },
        ...(propertyId
          ? {}
          : {
              property: {
                select: {
                  id: true,
                  nickname: true,
                  street: true,
                  city: true,
                  state: true,
                  zip: true,
                },
              },
            }),
      } as const;

      const ledgerTxns = await prisma.transaction.findMany({
        where: {
          propertyId: propertyId || undefined,
          categoryId: category.id,
          deletedAt: null,
          date: {
            gte: startDate,
            lt: endDateExclusive,
          },
        },
        select: transactionSelect,
        orderBy: [{ date: "asc" }, { id: "asc" }],
      });

      const ledgerRows: DrilldownRow[] = ledgerTxns
        .map((txn) => {
          const txnCategory = txn.category;
          if (!txnCategory) return null;
          const rawAmount = Number(txn.amount ?? 0);
          const normalizedAmount =
            txnCategory.type === "income" && rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;
          if (drillBucket === "annual") return null;
          drilldownTotal += normalizedAmount;
          const year = txn.date.getUTCFullYear();
          const month = String(txn.date.getUTCMonth() + 1).padStart(2, "0");
          const day = String(txn.date.getUTCDate()).padStart(2, "0");
          const rowPropertyLabel =
            propertyId || !("property" in txn) || !txn.property
              ? undefined
              : propertyLabel(txn.property);
          return {
            id: txn.id,
            type: "ledger",
            period: formatMonthYearUTC(txn.date),
            sortKey: `${year}-${month}-${day}`,
            dateLabel: formatInputDateUTC(txn.date),
            category: txnCategory.name,
            description: txn.payee || txn.memo || "-",
            propertyLabel: rowPropertyLabel,
            amount: normalizedAmount,
          };
        })
        .filter((row): row is DrilldownRow => Boolean(row));

      const startYear = startDate.getUTCFullYear();
      const endYear = endDate.getUTCFullYear();

      const annualSelect = {
        id: true,
        year: true,
        amount: true,
        note: true,
        category: { select: { name: true, type: true } },
        ...(propertyId
          ? {}
          : {
              property: {
                select: {
                  id: true,
                  nickname: true,
                  street: true,
                  city: true,
                  state: true,
                  zip: true,
                },
              },
            }),
      } as const;

      const annualRows = await prisma.annualCategoryAmount.findMany({
        where: {
          propertyId: propertyId || undefined,
          categoryId: category.id,
          year: { gte: startYear, lte: endYear },
        },
        select: annualSelect,
        orderBy: [{ year: "asc" }, { id: "asc" }],
      });

      const annualDetailRows: DrilldownRow[] = annualRows
        .map((row) => {
          const rowCategory = row.category;
          if (!rowCategory) return null;
          const baseAmount = Number(row.amount ?? 0);
          const normalizedAmount =
            rowCategory.type === "income" && baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;
          const prorated = prorateAnnualForRange(
            row.year,
            normalizedAmount,
            startDate,
            endDate
          );
          if (prorated === 0) return null;
          if (drillBucket === "transactional") return null;
          const rowPropertyLabel =
            propertyId || !("property" in row) || !row.property
              ? undefined
              : propertyLabel(row.property);
          drilldownTotal += prorated;
          return {
            id: row.id,
            type: "annual",
            period: `${row.year} (Annual)`,
            sortKey: `${row.year}-00-00`,
            dateLabel: "",
            category: rowCategory.name,
            description: row.note?.trim() || "Annual amount (prorated)",
            propertyLabel: rowPropertyLabel,
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
              <span className="ll_muted">Income by Category</span>
            </div>
            <h1>Income by Category</h1>
            <p className="ll_muted">
              Combined ledger and annual income totals by category within the selected date
              range. Transfers are {includeTransfers ? "included" : "excluded"}.
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
              <h2 className="text-base font-semibold text-slate-900">Category totals</h2>
              <p className="ll_muted text-sm">
                Showing income from {formatInputDateUTC(startDate)} to {formatInputDateUTC(endDate)}.
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
                  <th>Category</th>
                  <th className="!text-right">Transactional income</th>
                  <th className="!text-right">Annual prorated income</th>
                  <th className="!text-right">Total income</th>
                </tr>
              </thead>
              <tbody>
                {result.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center text-sm text-slate-600">
                      No income found for this range.
                    </td>
                  </tr>
                ) : (
                  result.rows.map((row) => (
                    <tr key={row.categoryId}>
                      <td>{row.categoryName}</td>
                      <td className="text-right">
                        <Link
                          href={`/reports/income-by-category?${buildReportQuery({
                            propertyId,
                            startDate,
                            endDate,
                            includeTransfers,
                            drillCategoryId: row.categoryId,
                            drillBucket: "transactional",
                          })}`}
                          className={`cursor-pointer inline-flex justify-end hover:underline underline-offset-2 ${amountClass(
                            row.transactionalIncomeCents
                          )}`}
                        >
                          {moneyAccounting(row.transactionalIncomeCents)}
                        </Link>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/reports/income-by-category?${buildReportQuery({
                            propertyId,
                            startDate,
                            endDate,
                            includeTransfers,
                            drillCategoryId: row.categoryId,
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
                          href={`/reports/income-by-category?${buildReportQuery({
                            propertyId,
                            startDate,
                            endDate,
                            includeTransfers,
                            drillCategoryId: row.categoryId,
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
                Details for {drillTarget.categoryName}
              </h2>
              <p className="ll_muted text-sm">
                {propertyScopeLabel} ·{" "}
                {drillBucket === "annual"
                  ? "Annual prorated income"
                  : drillBucket === "transactional"
                    ? "Transactional income"
                    : "Total income"}{" "}
                · {formatInputDateUTC(startDate)} to {formatInputDateUTC(endDate)} ·
                Transfers {includeTransfers ? "included" : "excluded"}.
              </p>
            </div>

            <div className="ll_table_wrap">
              <table className="ll_table ll_table_zebra w-full table-fixed">
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "180px" }} />
                  <col />
                  {!propertyId ? <col style={{ width: "180px" }} /> : null}
                  <col style={{ width: "150px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    {!propertyId ? <th>Property</th> : null}
                    <th className="!text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {drilldownRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={propertyId ? 5 : 6}
                        className="text-center text-sm text-slate-600"
                      >
                        No drill-down details available for this category.
                      </td>
                    </tr>
                  ) : (
                    drilldownRows.map((row) => (
                      <tr key={`${row.type}-${row.id}`}>
                        <td>{row.period}</td>
                        <td>{row.dateLabel}</td>
                        <td>{row.category}</td>
                        <td className="truncate">{row.description}</td>
                        {!propertyId ? <td>{row.propertyLabel ?? "-"}</td> : null}
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
                    <td colSpan={propertyId ? 4 : 5}>Total (drill-down)</td>
                    <td className="text-right">
                      <span className={amountClass(drilldownTargetTotal)}>
                        {moneyAccounting(drilldownTargetTotal)}
                      </span>
                    </td>
                  </tr>
                  {Math.abs(drilldownDifference) > 0.01 ? (
                    <tr>
                      <td
                        colSpan={propertyId ? 5 : 6}
                        className="text-right text-xs text-slate-500"
                      >
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
