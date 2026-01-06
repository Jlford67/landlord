import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getIncomeByCategoryReport, toYmd } from "@/lib/reports/incomeByCategory";

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
                        <span className={amountClass(row.transactionalIncomeCents)}>
                          {moneyAccounting(row.transactionalIncomeCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(row.annualIncomeCents)}>
                          {moneyAccounting(row.annualIncomeCents)}
                        </span>
                      </td>
                      <td className="text-right">
                        <span className={amountClass(row.totalIncomeCents)}>
                          {moneyAccounting(row.totalIncomeCents)}
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
      </div>
    </div>
  );
}
