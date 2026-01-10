import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import {
  getAnnualProfitAndLossSummary,
  type AnnualProfitAndLossSummaryResult,
} from "@/lib/reports/annualProfitAndLossSummary";

type SearchParams = Record<string, string | string[] | undefined>;

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

function renderYearSection(yearResult: AnnualProfitAndLossSummaryResult["years"][number]) {
  return (
    <div key={yearResult.year} className="ll_card ll_stack" style={{ gap: 12 }}>
      <div className="ll_rowBetween">
        <div>
          <h2 className="text-base font-semibold text-slate-900">
            {yearResult.year} Annual Profit &amp; Loss
          </h2>
          <p className="ll_muted text-sm">
            Ledger transactions and annual category amounts for the calendar year.
          </p>
        </div>
      </div>

      <div className="ll_table_wrap">
        <table className="ll_table ll_table_zebra w-full table-fixed">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Year</th>
              <th className="!text-right">Income total</th>
              <th className="!text-right">Expense total</th>
              <th className="!text-right">Net total</th>
            </tr>
          </thead>
          <tbody>
            <tr className="ll_table_total">
              <td>{yearResult.year}</td>
              <td className="text-right">
                <span className={amountClass(yearResult.incomeTotal)}>
                  {moneyAccounting(yearResult.incomeTotal)}
                </span>
              </td>
              <td className="text-right">
                <span className={amountClass(yearResult.expenseTotal)}>
                  {moneyAccounting(yearResult.expenseTotal)}
                </span>
              </td>
              <td className="text-right">
                <span className={amountClass(yearResult.netTotal)}>
                  {moneyAccounting(yearResult.netTotal)}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="ll_table_wrap">
        <table className="ll_table ll_table_zebra w-full table-fixed">
          <colgroup>
            <col style={{ width: "70%" }} />
            <col style={{ width: "30%" }} />
          </colgroup>
          <thead>
            <tr>
              <th>Category</th>
              <th className="!text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {yearResult.categories.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-sm text-slate-600">
                  No category activity for this year.
                </td>
              </tr>
            ) : (
              yearResult.categories.map((cat) => (
                <tr key={`${yearResult.year}-${cat.categoryId}`}>
                  <td>
                    <span
                      className="inline-block"
                      style={{ paddingLeft: `${cat.depth * 16}px` }}
                    >
                      {cat.name}
                    </span>
                  </td>
                  <td className="text-right">
                    <span className={amountClass(cat.amount)}>
                      {moneyAccounting(cat.amount)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default async function AnnualProfitAndLossSummaryPage({
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
  const currentYear = now.getUTCFullYear();

  const startYearParsed = parseYear(getStr(sp, "startYear"));
  const endYearParsed = parseYear(getStr(sp, "endYear"));

  let startYear = startYearParsed ?? endYearParsed ?? currentYear;
  let endYear = endYearParsed ?? startYearParsed ?? currentYear;

  if (startYear > endYear) {
    [startYear, endYear] = [endYear, startYear];
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

  const result = await getAnnualProfitAndLossSummary({
    propertyId,
    startYear,
    endYear,
    includeTransfers,
  });

  const hasYears = result.years.length > 0;
  const annualEntryLink = propertyId
    ? `/properties/${propertyId}/ledger?view=annual&year=${startYear}`
    : null;

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
              <span className="ll_muted">Annual Profit &amp; Loss Summary</span>
            </div>
            <h1>Annual Profit &amp; Loss Summary</h1>
            <p className="ll_muted">
              Calendar-year rollup combining ledger transactions and annual category amounts.
              Transfers are {includeTransfers ? "included" : "excluded"}.
            </p>
          </div>
          {annualEntryLink ? (
            <Link className="ll_btn ll_btnSecondary" href={annualEntryLink}>
              Annual entries
            </Link>
          ) : null}
        </div>

        <form className="ll_form" method="get">
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
              <label className="ll_label" htmlFor="startYear">
                Start year
              </label>
              <input
                id="startYear"
                name="startYear"
                type="number"
                className="ll_input"
                defaultValue={startYear}
                required
                suppressHydrationWarning
              />
            </div>

            <div>
              <label className="ll_label" htmlFor="endYear">
                End year
              </label>
              <input
                id="endYear"
                name="endYear"
                type="number"
                className="ll_input"
                defaultValue={endYear}
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
                defaultValue={includeTransfers ? "1" : "0"}
                suppressHydrationWarning
              >
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
          </div>

          <div className="ll_actions" style={{ marginTop: 14 }}>
            <button type="submit" className="ll_btn ll_btnPrimary" suppressHydrationWarning>
              Apply filters
            </button>
          </div>
        </form>

        {!hasYears ? (
          <div className="ll_card text-sm text-slate-600">
            No data found for the selected years and filters.
          </div>
        ) : (
          <div className="ll_stack" style={{ gap: 16 }}>
            {result.years.map((year) => renderYearSection(year))}

            <div className="ll_card ll_table_wrap">
              <table className="ll_table ll_table_zebra w-full table-fixed">
                <colgroup>
                  <col style={{ width: "40%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>All years</th>
                    <th className="!text-right">Income total</th>
                    <th className="!text-right">Expense total</th>
                    <th className="!text-right">Net total</th>
                  </tr>
                </thead>
                <tbody>
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
        )}
      </div>
    </div>
  );
}
