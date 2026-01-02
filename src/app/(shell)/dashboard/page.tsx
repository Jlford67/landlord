export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import prisma from "@/lib/prisma";
import { cookies } from "next/headers";
import { formatUsd, formatUsdFromCents } from "@/lib/money";
import PropertyPicker from "@/components/dashboard/PropertyPicker";
import PropertyPhoto from "@/components/properties/PropertyPhoto";

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

type UpcomingItem = {
  id: string;
  propertyName: string;
  categoryName: string;
  amountCents: number;
  dueDate: Date;
};

/* ---------------- recurring logic ---------------- */

function computeNextDue(
  recurring: {
    id: string;
    property: { nickname: string | null; street: string };
    category: { name: string };
    amountCents: number;
    dayOfMonth: number;
    startMonth: string;
    endMonth: string | null;
  }[],
  now: Date
): UpcomingItem[] {
  const nowUTC = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );

  const results: UpcomingItem[] = [];

  for (const r of recurring) {
    for (let add = 0; add <= 1; add++) {
      const due = new Date(
        Date.UTC(
          nowUTC.getUTCFullYear(),
          nowUTC.getUTCMonth() + add,
          Math.min(Math.max(r.dayOfMonth, 1), 28)
        )
      );

      const mk = monthKeyUTC(due);
      if (mk < r.startMonth) continue;
      if (r.endMonth && mk > r.endMonth) continue;
      if (due < nowUTC) continue;

      results.push({
        id: r.id,
        propertyName: propertyLabel(r.property),
        categoryName: r.category.name,
        amountCents: r.amountCents,
        dueDate: due,
      });

      break;
    }
  }

  results.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  return results;
}

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

  const [recentTxns, recurringActive] = await Promise.all([
    prisma.transaction.findMany({
      where: { deletedAt: null, ...whereProperty },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 10,
      include: {
        category: { select: { name: true } },
        property: { select: { nickname: true, street: true } },
      },
    }),
  
    prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        ...(selectedPropertyId ? { propertyId: selectedPropertyId } : {}),
      },
      orderBy: [{ dayOfMonth: "asc" }],
      include: {
        property: { select: { nickname: true, street: true } },
        category: { select: { name: true } },
      },
    }),
  ]);

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

  /* -------- recurring -------- */

  const upcoming = computeNextDue(
    recurringActive.map((r) => ({
      id: r.id,
      property: r.property,
      category: r.category,
      amountCents: r.amountCents,
      dayOfMonth: r.dayOfMonth,
      startMonth: r.startMonth,
      endMonth: r.endMonth,
    })),
    now
  ).slice(0, 3);

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
          <Link href="/transactions/new" className="ll_btn ll_btn_primary">
            Add transaction
          </Link>
        </div>
      </div>

      <div className="ll_dash_cards">
        {/* Cash Flow */}
        <section className="ll_card ll_dash_card">
          <div className="ll_dash_cardTop">
            <div className="ll_dash_cardTitle">Cash Flow</div>
            <Link href="/ledger" className="ll_dash_link">View ledger</Link>
          </div>

          <div className="ll_dash_moneyRow">
            <div className={`ll_dash_big ${net >= 0 ? "ll_amt_pos" : "ll_amt_neg"}`}>
              {net >= 0 ? "+" : "-"}{formatUsd(Math.abs(net))}
            </div>
            <div className="ll_dash_pill">{formatUsd(expenses)} expenses</div>
          </div>

          <div className="ll_dash_subRow">
            <div><span className="ll_dash_muted">income</span> {formatUsd(income)}</div>
            <div><span className="ll_dash_muted">expenses</span> -{formatUsd(expenses)}</div>
          </div>

          <div className="ll_dash_footerRow">
            <div className="ll_dash_muted">{cashflowLabel}</div>
          </div>

          <MiniIncomeExpenseBars points={months} />
        </section>

        {/* Upcoming Recurring */}
        <section className="ll_card ll_dash_card">
          <div className="ll_dash_cardTop">
            <div className="ll_dash_cardTitle">Upcoming Recurring</div>
            <Link href="/recurring" className="ll_dash_link">View all</Link>
          </div>

          <div className="ll_dash_list">
            {upcoming.length === 0 ? (
              <div className="ll_dash_empty">No upcoming items.</div>
            ) : (
              upcoming.map((u) => (
                <div key={u.id} className="ll_dash_listRow">
                  <div className="ll_dash_listLeft">
                    <div className="ll_dash_listTitle">{u.categoryName}</div>
                    <div className="ll_dash_listSub">
                      {u.propertyName} · {formatDateUTC(u.dueDate)}
                    </div>
                  </div>
                  <div className="ll_dash_listAmt">
                    {formatUsdFromCents(u.amountCents)}
                  </div>
                </div>
              ))
            )}
          </div>
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

      <div className="ll_dash_midHeader">
        <div className="ll_dash_sectionTitle">Transactions</div>
      </div>

      <section className="ll_card ll_dash_tableCard">
        <div className="ll_dash_tableWrap">
          <table className="ll_table w-full">
            <thead>
              <tr>
                <th style={{ width: 120 }}>Date</th>
                <th>Property</th>
                <th>Category</th>
                <th>Description</th>
                <th style={{ width: 140 }} className="text-right">Amount</th>
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
                      {isInc ? "+" : "-"}{formatUsd(Math.abs(t.amount))}
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
