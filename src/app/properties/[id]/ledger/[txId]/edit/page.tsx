import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function ym(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export default async function EditTransactionPage(props: {
  params: Promise<{ id: string; txId: string }>;
  searchParams?: Promise<{ month?: string }>;
}) {
  await requireUser();

  const { id: propertyId, txId } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const month = sp.month && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : ym(new Date());

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  const txn = await prisma.transaction.findFirst({
    where: { id: txId, propertyId },
    include: { category: true },
  });

  if (!property || !txn) {
    return (
      <div className="ll_page">
        <div className="ll_panel">
          <h1>Transaction not found</h1>
          <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${encodeURIComponent(month)}`}>
            Back to ledger
          </Link>
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, parentId: true },
  });

  const catLabel = (c: { name: string; parentId: string | null }) => {
    if (!c.parentId) return c.name;
    const parent = categories.find((p) => p.id === c.parentId);
    return parent ? `${parent.name} › ${c.name}` : c.name;
  };

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
          <div>
            <h1>Edit transaction</h1>
            <div className="ll_muted">
              {property.nickname?.trim() || "(no nickname)"} • {property.street}, {property.city}, {property.state} {property.zip}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${encodeURIComponent(month)}`}>
              Back
            </Link>
          </div>
        </div>

        <div style={{ marginTop: 14 }} className="ll_panelInner">
          <form className="ll_form" method="post" action={`/api/properties/${propertyId}/transactions/${txn.id}`}>
            <input type="hidden" name="month" value={month} />

            <div className="ll_grid2">
              <div>
                <label className="ll_label" htmlFor="date">
                  Date
                </label>
                <input
                  id="date"
                  name="date"
                  type="date"
                  className="ll_input"
                  defaultValue={txn.date.toISOString().slice(0, 10)}
                  required
                  suppressHydrationWarning
                />
              </div>

              <div>
                <label className="ll_label" htmlFor="categoryId">
                  Category
                </label>
                <select
                  id="categoryId"
                  name="categoryId"
                  className="ll_input"
                  defaultValue={txn.categoryId}
                  required
                  suppressHydrationWarning
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.type.toUpperCase()} • {catLabel(c)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="ll_label" htmlFor="amount">
                  Amount
                </label>
                <input
                  id="amount"
                  name="amount"
                  type="number"
                  step="0.01"
                  className="ll_input"
                  defaultValue={Math.abs(txn.amount).toFixed(2)}
                  required
                  suppressHydrationWarning
                />
                <div className="ll_muted">Enter a positive amount. We’ll store it as income/expense based on the category.</div>
              </div>

              <div>
                <label className="ll_label" htmlFor="payee">
                  Payee (optional)
                </label>
                <input
                  id="payee"
                  name="payee"
                  className="ll_input"
                  defaultValue={txn.payee ?? ""}
                  suppressHydrationWarning
                />
              </div>

              <div style={{ gridColumn: "1 / -1" }}>
                <label className="ll_label" htmlFor="memo">
                  Memo (optional)
                </label>
                <input
                  id="memo"
                  name="memo"
                  className="ll_input"
                  defaultValue={txn.memo ?? ""}
                  suppressHydrationWarning
                />
              </div>
            </div>

            <div className="ll_actions">
              <button className="ll_btn" type="submit" suppressHydrationWarning>
                Save changes
              </button>
              <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?month=${encodeURIComponent(month)}`}>
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .ll_panelInner { border-top: 1px solid rgba(255,255,255,0.08); padding-top: 14px; }
      `}</style>
    </div>
  );
}
