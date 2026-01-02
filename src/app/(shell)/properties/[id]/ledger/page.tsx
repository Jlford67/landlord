import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import RecurringPanel from "@/components/ledger/RecurringPanel";
import TransactionRowActions from "@/components/ledger/TransactionRowActions";

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

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
};

export default async function PropertyLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  await requireUser();

  const { id: propertyId } = await params;
  const sp = await searchParams;

  const month = sp.month ?? ym(new Date());

  const [yy, mm] = month.split("-").map(Number); // "2025-12"
  const start = new Date(Date.UTC(yy, mm - 1, 1, 0, 0, 0));
  const end = new Date(Date.UTC(yy, mm, 1, 0, 0, 0)); // first day of next month

  end.setUTCMonth(end.getUTCMonth() + 1);

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  if (!property) {
    return (
      <div>
        <h1 className="text-[28px] mb-2">Ledger</h1>
        <div className="ll_muted">Property not found.</div>
        <div className="mt-4">
          <Link className="ll_btnSecondary" href="/properties">
            Back to properties
          </Link>
        </div>
      </div>
    );
  }

  // Transactions for the month (hide deleted)
  const txns = await prisma.transaction.findMany({
    where: {
      propertyId,
      deletedAt: null,
      date: { gte: start, lt: end },
    },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { category: true },
  });

  // Recurring data
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  let recurringItems: Awaited<ReturnType<typeof prisma.recurringTransaction.findMany>> = [];
  let recurringTablesReady = true;
  let recurringErrorMsg: string | null = null;

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

  return (
    <div className="ll_page w-full max-w-none mx-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="text-[32px] m-0 mb-1.5">Ledger</h1>
        <div className="ll_muted">
          {propertyLabel(property)} · {monthLabel(month)}
        </div>
      
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${shiftMonth(month, -1)}`}>
            Prev
          </Link>
      
          <form method="get" className="flex items-center gap-2">
            <input
              className="ll_input w-[160px]"
              name="month"
              type="month"
              defaultValue={month}
              suppressHydrationWarning
              data-lpignore="true"
            />
            <button className="ll_btnSecondary" type="submit" suppressHydrationWarning data-lpignore="true">
              Go
            </button>
          </form>
      
          <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${shiftMonth(month, 1)}`}>
            Next
          </Link>
        </div>
      </div>

        <div className="flex gap-2.5 items-center">
          <Link className="ll_btnSecondary" href="/properties">
            Back
          </Link>

          <Link
            className="ll_btnPrimary"
            href={`/properties/${propertyId}/ledger/new?returnTo=${encodeURIComponent(
              `/properties/${propertyId}/ledger?month=${month}`
            )}`}
          >
            Add transaction
          </Link>
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6 mt-4 items-start w-full">
        {/* Left: transactions */}
        <div className="ll_card">
          <div className="ll_cardHeader">
            <div>
              <div className="ll_h2">Transactions</div>
              <div className="ll_muted">{monthLabel(month)}</div>
            </div>

            <Link className="ll_btn ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${month}`}>
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
                      <th className="w-[140px] text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {txns.map((t: any) => (
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
                          {t.amount.toFixed(2)}
                        </td>

                        <td className="text-right">
                          <div className="flex justify-end">
                            <TransactionRowActions transaction={t} />
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

        {/* Right: recurring */}
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
    </div>
  );
}
