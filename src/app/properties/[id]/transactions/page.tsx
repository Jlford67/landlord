import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

function money(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "USD" });
}
function fmtDate(d: Date) {
  return new Date(d).toLocaleDateString();
}

export default async function PropertyTransactionsPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();

  const property = await prisma.property.findUnique({
    where: { id: params.id },
    include: {
      transactions: {
        orderBy: [{ date: "desc" }],
        take: 200,
        include: { category: true },
      },
    },
  });

  if (!property) notFound();

  const title =
    property.nickname?.trim() ||
    `${property.street}, ${property.city}, ${property.state} ${property.zip}`;

  const total = property.transactions.reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>
              Transactions · {title}
            </div>
            <div style={{ opacity: 0.85, marginTop: 2, fontSize: 13 }}>
              Showing latest {property.transactions.length} (max 200)
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Back
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 16, opacity: 0.9 }}>
          <div style={{ fontWeight: 700 }}>Total (shown)</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{money(total)}</div>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.12)" }}>
          {property.transactions.length ? (
            <div style={{ display: "grid", gap: 10 }}>
              {property.transactions.map((t) => (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 0",
                    borderBottom: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>
                      {fmtDate(t.date)} · {t.category.name}
                    </div>
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {t.payee ?? "—"}{t.memo ? ` · ${t.memo}` : ""}
                    </div>
                    <div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>
                      Source: {t.source}{" "}
                      {t.statementMonth ? `· Statement: ${t.statementMonth}` : ""}
                      {t.isOwnerPayout ? " · Owner payout" : ""}
                    </div>
                  </div>

                  <div style={{ fontWeight: 800, whiteSpace: "nowrap" }}>
                    {money(t.amount)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ opacity: 0.75 }}>No transactions yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
