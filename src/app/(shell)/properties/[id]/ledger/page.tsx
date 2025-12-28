import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import RecurringPanel from "@/components/ledger/RecurringPanel";
import TransactionRowActions from "@/components/ledger/TransactionRowActions";

function ym(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const mm = Number(m);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mm - 1]} ${y}`;
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
        <h1 style={{ fontSize: 28, marginBottom: 8 }}>Ledger</h1>
        <div className="ll_muted">Property not found.</div>
        <div style={{ marginTop: 16 }}>
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

  // Recurring data (same pattern you already use on the other ledger page)
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
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 32, margin: 0, marginBottom: 6 }}>Ledger</h1>
          <div className="ll_muted">
            {propertyLabel(property)} · {monthLabel(month)}
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 520px",
          gap: 24,
          marginTop: 16,
          alignItems: "start",
        }}
      >
        {/* Left: transactions */}
        <div className="ll_panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>Transactions</div>

            <div style={{ display: "flex", gap: 8 }}>
              <Link
                className="ll_btnSecondary"
                href={`/properties/${propertyId}/ledger?month=${month}`}
              >
                Refresh
              </Link>
            </div>
          </div>

          <div className="ll_muted" style={{ marginTop: 6 }}>
            {monthLabel(month)}
          </div>

          <div style={{ marginTop: 12 }}>
            {txns.length === 0 ? (
              <div className="ll_muted">No transactions for this month.</div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ll_table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th style={{ width: 120 }}>Date</th>
                      <th style={{ width: "36%" }}>Category</th>
                      <th style={{ width: "34%" }}>Memo</th>
                      <th style={{ textAlign: "right", width: 130 }}>Amount</th>
                      <th style={{ textAlign: "right", width: 190 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txns.map((t: any) => (
                      <tr key={t.id}>
                        <td style={{ whiteSpace: "nowrap" }}>
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
                  
                        <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                          {t.amount.toFixed(2)}
                        </td>
                  
                        <td style={{ textAlign: "right" }}>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 6,
                              alignItems: "flex-end",
                            }}
                          >
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
        <div className="ll_panel">
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
