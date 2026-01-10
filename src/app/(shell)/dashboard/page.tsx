export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { formatUsd } from "@/lib/money";
import PropertyPicker from "@/components/dashboard/PropertyPicker";
import PropertyPhoto from "@/components/properties/PropertyPhoto";
import AnnualBarChartClient from "./AnnualBarChartClient";

/* ---------------- date helpers ---------------- */

function startOfMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function startOfNextMonthUTC(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
}

function addMonthsUTC(d: Date, months: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

function monthKeyUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function formatDateUTC(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "UTC" });
}

function formatMonthLabelUTC(d: Date) {
  return d.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
}

/** Accounting-style: positives like $1,234.56; negatives like ($1,234.56) */
function moneyAccounting(n: number) {
  const abs = Math.abs(n).toLocaleString(undefined, {
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

/* ---------------- misc helpers ---------------- */

function propertyLabel(p: { nickname: string | null; street: string }) {
  return (p.nickname ?? "").trim() || p.street;
}

function daysAgoUTC(d: Date, days: number) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - days));
}

/* ---------------- types ---------------- */

type MonthPoint = {
  key: string;
  label: string;
  income: number;
  expenses: number;
};

type YearRow = {
  year: number;
  income: number;
  expenses: number; // negative
  net: number;
};

/* ---------------- chart ---------------- */

function MiniIncomeExpenseBars({ points }: { points: MonthPoint[] }) {
  const max = Math.max(1, ...points.map((p) => Math.max(p.income, p.expenses)));

  return (
    <div className="ll_dash_ieChart">
      {points.map((p) => (
        <div key={p.key} className="ll_dash_ieCol">
          <div className="ll_dash_ieStack">
            <div
              className="ll_dash_ieBar ll_dash_ieBarInc"
              style={{ height: `${(p.income / max) * 54}px` }}
            />
            <div
              className="ll_dash_ieBar ll_dash_ieBarExp"
              style={{ height: `${(p.expenses / max) * 54}px` }}
            />
          </div>
          <div className="ll_dash_ieLbl">{p.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ================= PAGE ================= */

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{ propertyId?: string }>;
}) {
  const sp = (await searchParams) ?? {};

  const cookieStore: any = await cookies();
  const cookiePropertyId =
    typeof cookieStore.get === "function"
      ? cookieStore.get("ll_dashboard_propertyId")?.value
      : cookieStore?.ll_dashboard_propertyId;

  const selectedPropertyId =
    (sp.propertyId ?? "").trim() ||
    (cookiePropertyId ?? "").trim() ||
    null;

  const now = new Date();
  const monthStart = startOfMonthUTC(now);
  const nextMonthStart = startOfNextMonthUTC(now);
  const cashflowStart = daysAgoUTC(now, 30);

  /* -------- properties -------- */

  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  const pickerOptions = properties.map((p) => ({
    id: p.id,
    label: propertyLabel(p),
  }));

  const whereProperty = selectedPropertyId
    ? { propertyId: selectedPropertyId }
    : {};

  /* -------- main queries -------- */

  const [recentTxns] = await Promise.all([
    prisma.transaction.findMany({
      where: { deletedAt: null, ...whereProperty },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 10,
      include: {
        category: { select: { name: true } },
        property: { select: { nickname: true, street: true } },
      },
    }),
  ]);

  /* -------- Yearly Summary (merged) -------- */

  // 1) Ledger transactions
  const txnsForYearly = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      ...whereProperty,
      category: { type: { not: "transfer" } }, // exclude transfers
    },
    select: { date: true, amount: true },
  });

  const yearlyFromTxns = new Map<number, { income: number; expenses: number; net: number }>();

  for (const t of txnsForYearly) {
    const y = t.date.getUTCFullYear();
    const cur = yearlyFromTxns.get(y) ?? { income: 0, expenses: 0, net: 0 };

    if (t.amount >= 0) cur.income += t.amount;
    else cur.expenses += t.amount; // keep negative

    cur.net += t.amount;
    yearlyFromTxns.set(y, cur);
  }

  // 2) Annual imported totals
  const annualRows = selectedPropertyId
    ? await prisma.annualCategoryAmount.findMany({
        where: {
          propertyId: selectedPropertyId,
          category: { type: { not: "transfer" } }, // exclude transfers
        },
        select: {
          year: true,
          amount: true, // +income, -expense
        },
      })
    : [];

  const yearlyFromAnnual = new Map<number, { income: number; expenses: number; net: number }>();

  for (const r of annualRows) {
    const cur = yearlyFromAnnual.get(r.year) ?? { income: 0, expenses: 0, net: 0 };

    if (r.amount >= 0) cur.income += r.amount;
    else cur.expenses += r.amount; // keep negative

    cur.net += r.amount;
    yearlyFromAnnual.set(r.year, cur);
  }

  // 3) Merge: sum ledger + annual for matching years
  const allYears = new Set<number>([
    ...Array.from(yearlyFromTxns.keys()),
    ...Array.from(yearlyFromAnnual.keys()),
  ]);

  const yearlyRows: YearRow[] = Array.from(allYears)
    .map((year) => {
      const fromTxns = yearlyFromTxns.get(year) ?? { income: 0, expenses: 0, net: 0 };
      const fromAnnual = yearlyFromAnnual.get(year) ?? { income: 0, expenses: 0, net: 0 };
      return {
        year,
        income: fromTxns.income + fromAnnual.income,
        expenses: fromTxns.expenses + fromAnnual.expenses,
        net: fromTxns.net + fromAnnual.net,
      };
    })
    .filter((r) => r.income !== 0 || r.expenses !== 0 || r.net !== 0)
    .sort((a, b) => b.year - a.year);

    const yearlyTotals = yearlyRows.reduce(
      (acc, r) => {
        acc.income += r.income;
        acc.expenses += r.expenses;
        acc.net += r.net;
        return acc;
      },
      { income: 0, expenses: 0, net: 0 }
    );

  const annualChartData = yearlyRows
    .slice()
    .sort((a, b) => a.year - b.year)
    .map((row) => ({ year: row.year, net: row.net }));

  /* -------- chart data -------- */

  const chartStart = addMonthsUTC(monthStart, -11);

  const chartTxns = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      date: { gte: chartStart, lt: nextMonthStart },
      ...whereProperty,
    },
    select: { amount: true, date: true },
  });

  const months: MonthPoint[] = [];
  for (let i = 0; i < 12; i++) {
    const d = addMonthsUTC(chartStart, i);
    months.push({
      key: monthKeyUTC(d),
      label: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short" }),
      income: 0,
      expenses: 0,
    });
  }

  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const t of chartTxns) {
    const k = monthKeyUTC(t.date);
    const i = idx.get(k);
    if (i === undefined) continue;
    if (t.amount >= 0) months[i].income += t.amount;
    else months[i].expenses += Math.abs(t.amount);
  }

  // Rolling 12-month monthly averages, ignoring months with no activity
  const activeMonths = months.filter((m) => m.income > 0 || m.expenses > 0);
  const activeCount = activeMonths.length;

  const incomeTotal = activeMonths.reduce((s, m) => s + m.income, 0);
  const expensesTotal = activeMonths.reduce((s, m) => s + m.expenses, 0);

  const income = activeCount ? incomeTotal / activeCount : 0;
  const expenses = activeCount ? expensesTotal / activeCount : 0;
  const net = income - expenses;

  const cashflowLabel = activeCount
    ? `Average of ${activeCount} month${activeCount === 1 ? "" : "s"}`
    : "No data yet";

  const featuredProperty =
    selectedPropertyId
      ? properties.find((p) => p.id === selectedPropertyId) ?? null
      : properties[0] ?? null;

  /* -------- render -------- */

  return (
    <div className="ll_dash">
      <div className="ll_dash_top">
        <div className="ll_dash_title">Dashboard</div>

        <div className="ll_dash_topRight">
          <PropertyPicker properties={pickerOptions} selectedId={selectedPropertyId} />

          <Link href="/transactions/new" className="ll_btn ll_btnPrimary">
            Add transaction
          </Link>
        </div>
      </div>

      <div className="ll_dash_cards">
        {/* Cash Flow */}
        <section className="ll_card ll_dash_card">
          <div className="ll_dash_cardTop">
            <div className="ll_dash_cardTitle">Cash Flow</div>
            <Link href="/ledger" className="ll_dash_link">
              View ledger
            </Link>
          </div>

          <div className="ll_dash_moneyRow">
            <div className={`ll_dash_big ${net >= 0 ? "ll_amt_pos" : "ll_amt_neg"}`}>
              {net >= 0 ? "+" : "-"}
              {formatUsd(Math.abs(net))}
            </div>
            <div className="ll_dash_pill">{formatUsd(expenses)} expenses</div>
          </div>

          <div className="ll_dash_subRow">
            <div>
              <span className="ll_dash_muted">income</span> {formatUsd(income)}
            </div>
            <div>
              <span className="ll_dash_muted">expenses</span> -{formatUsd(expenses)}
            </div>
          </div>

          <div className="ll_dash_footerRow">
            <div className="ll_dash_muted">{cashflowLabel}</div>
          </div>

          <MiniIncomeExpenseBars points={months} />
        </section>

        {/* Annual Net Profit */}
        <section className="ll_card ll_dash_card">
          <div className="ll_dash_cardTop">
            <div className="ll_dash_cardTitle">Annual Net Profit</div>
          </div>

          {annualChartData.length === 0 ? (
            <div className="ll_dash_empty">No annual data yet.</div>
          ) : (
            <AnnualBarChartClient data={annualChartData} />
          )}
        </section>

        {/* Property */}
        <section className="ll_card ll_dash_card ll_dash_propertyCard">
          {featuredProperty && (
            <PropertyPhoto
              propertyId={featuredProperty.id}
              alt={propertyLabel(featuredProperty)}
              className="ll_dash_photo"
            />
          )}
          <div className="ll_dash_propBody">
            <div className="ll_dash_propTitle">
              {featuredProperty ? propertyLabel(featuredProperty) : "No properties yet"}
            </div>

            {featuredProperty ? (
              <div className="ll_dash_propSub">
                <div>{featuredProperty.street}</div>
                <div>
                  {featuredProperty.city}, {featuredProperty.state} {featuredProperty.zip}
                </div>
              </div>
            ) : (
              <div className="ll_dash_propSub">Add a property to get started.</div>
            )}
          </div>
        </section>
      </div>

      {/* Yearly Summary */}
      <div className="ll_dash_midHeader">
        <div className="ll_dash_sectionTitle">Yearly Summary</div>
      </div>

      <section className="ll_card ll_dash_tableCard">
        <div className="ll_dash_tableWrap">
          <table className="ll_table w-full table-fixed">

            <thead>
              <tr>
                <th style={{ width: 120 }} className="text-left !text-left">
                  Year
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Income
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Expenses
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Net Profit
                </th>
              </tr>
            </thead>
                      

            <tbody>
              {yearlyRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    No data yet
                  </td>
                </tr>
              ) : (
                <>
                  {yearlyRows.map((r) => (
                    <tr key={r.year}>
                      <td className="font-medium">{r.year}</td>
                      <td className={`text-right ${amountClass(r.income)}`}>
                        {moneyAccounting(r.income)}
                      </td>
                      <td className={`text-right ${amountClass(r.expenses)}`}>
                        {moneyAccounting(r.expenses)}
                      </td>
                      <td className={`text-right font-medium ${amountClass(r.net)}`}>
                        {moneyAccounting(r.net)}
                      </td>
                    </tr>
                  ))}

                  {/* Totals row */}
                  <tr className="border-t border-gray-200">
                    <td className="font-semibold">Total</td>
                    <td className={`text-right font-semibold ${amountClass(yearlyTotals.income)}`}>
                      {moneyAccounting(yearlyTotals.income)}
                    </td>
                    <td className={`text-right font-semibold ${amountClass(yearlyTotals.expenses)}`}>
                      {moneyAccounting(yearlyTotals.expenses)}
                    </td>
                    <td className={`text-right font-semibold ${amountClass(yearlyTotals.net)}`}>
                      {moneyAccounting(yearlyTotals.net)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Transactions */}
      <div className="ll_dash_midHeader">
        <div className="ll_dash_sectionTitle">Transactions</div>
      </div>

      <section className="ll_card ll_dash_tableCard">
        <div className="ll_dash_tableWrap">
          <table className="ll_table w-full table-fixed">

            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th>Property</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ width: 140 }} className="text-right">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {recentTxns.map((t) => {
                const isInc = t.amount >= 0;
                return (
                  <tr key={t.id}>
                    <td>{formatDateUTC(t.date)}</td>
                    <td>{propertyLabel(t.property)}</td>
                    <td>{t.category.name}</td>
                    <td>{t.payee || t.memo || "-"}</td>
                    <td className={`text-right ${isInc ? "ll_amt_pos" : "ll_amt_neg"}`}>
                      {isInc ? "+" : "-"}
                      {formatUsd(Math.abs(t.amount))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
