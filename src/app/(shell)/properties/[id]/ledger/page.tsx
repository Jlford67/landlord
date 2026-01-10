import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import RecurringPanel from "@/components/ledger/RecurringPanel";
import TransactionRowActions from "@/components/ledger/TransactionRowActions";
import PropertyHeader from "@/components/properties/PropertyHeader";
import IconButton from "@/components/ui/IconButton";
import { PencilLine, Trash2 } from "lucide-react";
import { promises as fs } from "fs";
import path from "path";
import { deleteAnnualEntry } from "./actions";

/* ---------------- helpers ---------------- */

function ym(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const mm = Number(m);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mm - 1]} ${y}`;
}

function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  d.setUTCMonth(d.getUTCMonth() + delta);
  return ym(d);
}

function parseYear(raw: string | undefined, fallback: number) {
  const num = Number(raw);
  if (!Number.isFinite(num)) return fallback;
  return Math.trunc(num);
}

async function findPropertyPhotoSrc(propertyId: string): Promise<string | null> {
  // Files live in /public/property-photos; URLs are /property-photos/<file>
  const dir = path.join(process.cwd(), "public", "property-photos");
  const candidates = [
    `${propertyId}.webp`,
    `${propertyId}.jpg`,
    `${propertyId}.jpeg`,
    `${propertyId}.png`,
  ];

  for (const file of candidates) {
    try {
      await fs.access(path.join(dir, file));
      return `/property-photos/${file}`;
    } catch {
      // keep trying
    }
  }

  return null;
}

const kpiMoney = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatAmountDisplay(amount: number) {
  if (amount === 0) {
    return { text: currencyFormatter.format(0), className: "ll_muted" };
  }

  const abs = currencyFormatter.format(Math.abs(amount));

  if (amount < 0) return { text: `(${abs})`, className: "ll_neg" };
  return { text: abs, className: "ll_pos" };
}

type AnnualRow = Prisma.AnnualCategoryAmountGetPayload<{
  include: {
    category: { select: { id: true; name: true; type: true; parentId: true } };
    propertyOwnership: { include: { entity: { select: { name: true } } } };
  };
}>;

/* ---------------- page ---------------- */

export default async function PropertyLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; view?: string; year?: string }>;
}) {
  await requireUser();

  const { id: propertyId } = await params;
  const sp = await searchParams;

  const monthParam = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : "";
  const month = monthParam || ym(new Date());
  const monthValue = monthParam || month;
  const view = sp.view === "annual" ? "annual" : "monthly";

  const [yy, mm] = month.split("-").map(Number);
  const start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 1, 0, 0, 0)); // first day of next month
  const year = parseYear(sp.year, yy);

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  if (!property) {
    return (
      <div>
        <h1 className="text-[28px] mb-2">Ledger</h1>
        <div className="ll_muted">Property not found.</div>
        <div className="mt-3">
          <Link className="ll_btnSecondary" href="/properties">
            Back to properties
          </Link>
        </div>
      </div>
    );
  }

  const photoSrc = await findPropertyPhotoSrc(propertyId);

  /* -------- data -------- */

  let txns: Awaited<ReturnType<typeof prisma.transaction.findMany>> = [];
  let monthIncome = 0;
  let monthExpenses = 0;
  let monthNet = 0;

  let annualRows: AnnualRow[] = [];
  let annualIncome = 0;
  let annualExpenses = 0;
  let annualNet = 0;

  let categories: Awaited<ReturnType<typeof prisma.category.findMany>> = [];
  let recurringItems: Awaited<ReturnType<typeof prisma.recurringTransaction.findMany>> = [];
  let recurringTablesReady = true;
  let recurringErrorMsg: string | null = null;

  if (view === "monthly") {
    txns = await prisma.transaction.findMany({
      where: {
        propertyId,
        deletedAt: null,
        date: { gte: start, lt: end },
      },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: { category: true },
    });

    monthIncome = txns
      .filter((t) => t.category?.type === "income")
      .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);

    monthExpenses = txns
      .filter((t) => t.category?.type === "expense")
      .reduce((s, t) => s + Math.abs(Number(t.amount ?? 0)), 0);

    monthNet = monthIncome - monthExpenses;

    categories = await prisma.category.findMany({
      where: { active: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    try {
      recurringItems = await prisma.recurringTransaction.findMany({
        where: { propertyId },
        include: { category: true, postings: true },
        orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }, { createdAt: "asc" }],
      });
    } catch (error: any) {
      recurringErrorMsg = error?.message ?? String(error);
      console.error("recurringTransaction.findMany failed", error);

      if (error?.code === "P2021") {
        recurringTablesReady = false;
      } else {
        throw error;
      }
    }
  }

  if (view === "annual") {
    const [annualEntries, allCategories] = await Promise.all([
      prisma.annualCategoryAmount.findMany({
        where: { propertyId, year },
        include: {
          category: { select: { id: true, name: true, type: true, parentId: true } },
          propertyOwnership: { include: { entity: { select: { name: true } } } },
        },
        orderBy: [
          { category: { type: "asc" } },
          { category: { name: "asc" } },
          { propertyOwnershipId: "asc" },
        ],
      }),
      prisma.category.findMany({
        select: { id: true, name: true, parentId: true },
      }),
    ]);

    annualRows = annualEntries;

    const categoryMap = new Map(
      allCategories.map((cat) => [cat.id, { name: cat.name, parentId: cat.parentId }])
    );

    const pathCache = new Map<string, string>();
    const categoryPath = (id: string, fallback: string) => {
      if (pathCache.has(id)) return pathCache.get(id) ?? fallback;
      const names: string[] = [];
      let cursor: string | null = id;
      while (cursor) {
        const found = categoryMap.get(cursor);
        if (!found) break;
        names.unshift(found.name);
        cursor = found.parentId;
      }
      const label = names.length > 0 ? names.join(" › ") : fallback;
      pathCache.set(id, label);
      return label;
    };

    annualRows = annualRows.map((row) => ({
      ...row,
      category: {
        ...row.category,
        name: categoryPath(row.category.id, row.category.name),
      },
    }));

    annualIncome = annualRows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    annualExpenses = annualRows
      .filter((r) => r.amount < 0)
      .reduce((s, r) => s + Math.abs(r.amount), 0);
    annualNet = annualIncome - annualExpenses;
  }

  const annualView = view === "annual";
  const headerKpis = annualView
    ? [
        { label: "Income", value: kpiMoney(annualIncome) },
        { label: "Expenses", value: kpiMoney(annualExpenses), className: "ll_neg" },
        { label: "Net", value: kpiMoney(annualNet), className: annualNet >= 0 ? "ll_pos" : "ll_neg" },
      ]
    : [
        { label: "Income", value: kpiMoney(monthIncome) },
        { label: "Expenses", value: kpiMoney(monthExpenses), className: "ll_neg" },
        { label: "Net", value: kpiMoney(monthNet), className: monthNet >= 0 ? "ll_pos" : "ll_neg" },
      ];

  const ownershipLabel = (ownership: AnnualRow["propertyOwnership"] | null) => {
    if (!ownership) return "None";
    const pct = Number.isFinite(ownership.ownershipPct) ? ownership.ownershipPct : null;
    return pct ? `${ownership.entity.name} (${pct}%)` : ownership.entity.name;
  };

  /* ---------------- render ---------------- */

  return (
    <div className="ll_page w-full max-w-none mx-0">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] m-0 mb-1.5">Ledger</h1>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            {annualView ? (
              <>
                <Link
                  className="ll_btnSecondary"
                  href={`/properties/${propertyId}/ledger?view=annual&year=${year - 1}&month=${month}`}
                >
                  Prev year
                </Link>

                <form method="get" className="flex items-center gap-2">
                  <input type="hidden" name="view" value="annual" />
                  <input type="hidden" name="month" value={month} />
                  <input
                    className="ll_input w-[120px]"
                    name="year"
                    type="number"
                    defaultValue={year ?? ""}
                    suppressHydrationWarning
                    data-lpignore="true"
                  />
                  <button
                    className="ll_btnSecondary"
                    type="submit"
                    suppressHydrationWarning
                    data-lpignore="true"
                  >
                    Go
                  </button>
                </form>

                <Link
                  className="ll_btnSecondary"
                  href={`/properties/${propertyId}/ledger?view=annual&year=${year + 1}&month=${month}`}
                >
                  Next year
                </Link>
              </>
            ) : (
              <>
                <Link
                  className="ll_btnSecondary"
                  href={`/properties/${propertyId}/ledger?month=${shiftMonth(month, -1)}`}
                >
                  Prev
                </Link>

                <form method="get" className="flex items-center gap-2">
                  <input type="hidden" name="view" value="monthly" />
                  <input
                    className="ll_input w-[160px]"
                    name="month"
                    type="month"
                    defaultValue={monthValue}
                    placeholder="YYYY-MM"
                  />

                  <button
                    className="ll_btnSecondary"
                    type="submit"
                    suppressHydrationWarning
                    data-lpignore="true"
                  >
                    Go
                  </button>
                </form>

                <Link
                  className="ll_btnSecondary"
                  href={`/properties/${propertyId}/ledger?month=${shiftMonth(month, 1)}`}
                >
                  Next
                </Link>
              </>
            )}

            <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-1">
              <Link
                className={`ll_btnSecondary ${annualView ? "" : "ll_btn_primary"}`}
                href={`/properties/${propertyId}/ledger?view=monthly&month=${month}`}
              >
                Monthly
              </Link>
              <Link
                className={`ll_btnSecondary ${annualView ? "ll_btn_primary" : ""}`}
                href={`/properties/${propertyId}/ledger?view=annual&year=${year}&month=${month}`}
              >
                Annual
              </Link>
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 items-center">
          <Link className="ll_btnSecondary" href="/properties">
            Back
          </Link>

          <Link
            className={annualView ? "ll_btnSecondary" : "ll_btnPrimary"}
            href={`/properties/${propertyId}/ledger/new?returnTo=${encodeURIComponent(
              `/properties/${propertyId}/ledger?month=${month}`
            )}`}
          >
            Add transaction
          </Link>

          <Link
            className={annualView ? "ll_btnPrimary" : "ll_btnSecondary"}
            href={`/properties/${propertyId}/annual/new?year=${year}&view=annual`}
          >
            Add annual entry
          </Link>
        </div>
      </div>

      {/* Property header */}
      <div className="mt-3">
        <PropertyHeader
          property={{
            id: property.id,
            nickname: property.nickname,
            street: property.street,
            city: property.city,
            state: property.state,
            zip: property.zip,
            photoUrl: photoSrc ?? null,
          }}
          href={`/properties/${propertyId}`}
          subtitle={annualView ? "Annual" : "Ledger"}
          kpis={headerKpis}
        />
      </div>

      {/* Content */}
      {annualView ? (
        <div className="grid grid-cols-1 gap-6 mt-4 items-start w-full">
          <div className="ll_card">
            <div className="ll_cardHeader">
              <div>
                <div className="ll_h2">Annual Summary – {year}</div>
                <div className="ll_muted">Annual entries for this property and year.</div>
              </div>

              <Link
                className="ll_btn ll_btnSecondary"
                href={`/properties/${propertyId}/annual/new?year=${year}&view=annual`}
              >
                Add annual entry
              </Link>
            </div>

            <div className="ll_cardPad">
              <div className="mb-4 flex flex-wrap gap-6 text-sm">
                <div>
                  <div className="ll_muted">Income</div>
                  {(() => {
                    const formatted = formatAmountDisplay(annualIncome);
                    return <div className={`font-semibold ${formatted.className}`}>{formatted.text}</div>;
                  })()}
                </div>
                <div>
                  <div className="ll_muted">Expenses</div>
                  {(() => {
                    const formatted = formatAmountDisplay(-annualExpenses);
                    return <div className={`font-semibold ${formatted.className}`}>{formatted.text}</div>;
                  })()}
                </div>
                <div>
                  <div className="ll_muted">Net</div>
                  {(() => {
                    const formatted = formatAmountDisplay(annualNet);
                    return <div className={`font-semibold ${formatted.className}`}>{formatted.text}</div>;
                  })()}
                </div>
              </div>

              {annualRows.length === 0 ? (
                <div className="ll_muted">No annual entries yet for this year.</div>
              ) : (
                <div className="ll_table_wrap">
                  <table className="ll_table ll_table_zebra w-full">
                    <thead>
                      <tr>
                        <th className="w-[34%]">Category</th>
                        <th className="w-[15%] text-right">Amount</th>
                        <th className="w-[18%]">Ownership</th>
                        <th className="w-[25%]">Note</th>
                        <th className="w-[8%] text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {annualRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="ll_muted">{row.category.type.toUpperCase()}</span>{" "}
                            {row.category.name}
                          </td>
                          <td className="text-right whitespace-nowrap tabular-nums">
                            {(() => {
                              const formatted = formatAmountDisplay(Number(row.amount ?? 0));
                              return <span className={formatted.className}>{formatted.text}</span>;
                            })()}
                          </td>
                          <td>{ownershipLabel(row.propertyOwnership)}</td>
                          <td>{row.note || <span className="ll_muted">(none)</span>}</td>
                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <Link
                                className="ll_btnSecondary inline-flex items-center justify-center"
                                href={`/properties/${propertyId}/annual/${row.id}/edit?year=${year}&view=annual`}
                                aria-label={`Edit ${row.category.name}`}
                                title="Edit"
                              >
                                <PencilLine size={16} />
                              </Link>

                              <form action={deleteAnnualEntry}>
                                <input type="hidden" name="propertyId" value={propertyId} />
                                <input type="hidden" name="year" value={year} />
                                <input type="hidden" name="month" value={month} />
                                <input type="hidden" name="id" value={row.id} />
                                <IconButton
                                  className="ll_btnSecondary"
                                  type="submit"
                                  ariaLabel={`Delete ${row.category.name}`}
                                  title="Delete"
                                  icon={<Trash2 size={16} />}
                                />
                              </form>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 mt-4 items-start w-full">
          {/* Transactions */}
          <div className="ll_card">
            <div className="ll_cardHeader">
              <div>
                <div className="ll_h2">Transactions</div>
                <div className="ll_muted">{monthLabel(month)}</div>
              </div>

              <Link
                className="ll_btn ll_btnSecondary"
                href={`/properties/${propertyId}/ledger?month=${month}`}
              >
                Refresh
              </Link>
            </div>

            <div className="ll_cardPad">
              {txns.length === 0 ? (
                <div className="ll_muted">No transactions for this month.</div>
              ) : (
                <div className="ll_table_wrap">
                  <table className="ll_table ll_table_zebra w-full">
                    <thead>
                      <tr>
                        <th className="w-[120px]">Date</th>
                        <th className="w-[36%]">Category</th>
                        <th className="w-[34%]">Memo</th>
                        <th className="w-[110px] text-right">Amount</th>
                        <th className="w-[160px] text-right">Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {txns.map((t) => (
                        <tr key={t.id}>
                          <td className="whitespace-nowrap">
                            {new Date(t.date).toLocaleDateString(undefined, {
                              weekday: "short",
                              month: "short",
                              day: "2-digit",
                              timeZone: "UTC",
                            })}
                          </td>

                          <td>
                            <span className="ll_muted">{t.category.type.toUpperCase()}</span>{" "}
                            {t.category.name}
                          </td>

                          <td>{t.memo || <span className="ll_muted">(none)</span>}</td>

                          <td className="text-right whitespace-nowrap tabular-nums">
                            {(() => {
                              const formatted = formatAmountDisplay(Number(t.amount ?? 0));
                              return <span className={formatted.className}>{formatted.text}</span>;
                            })()}
                          </td>

                          <td className="text-right">
                            <div className="flex justify-end gap-2">
                              <TransactionRowActions
                                transactionId={t.id}
                                propertyId={propertyId}
                                month={month}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Recurring panel */}
          <div className="ll_card recurring w-full">
            {recurringTablesReady ? (
              <RecurringPanel
                propertyId={propertyId}
                categories={categories}
                recurringItems={recurringItems}
                recurringTablesReady={recurringTablesReady}
                recurringErrorMsg={recurringErrorMsg}
                month={month}
              />
            ) : (
              <div className="ll_muted">Tables not ready yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
