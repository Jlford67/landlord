import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import NewTransactionForm from "./NewTransactionForm";

function todayUtcYmd() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  await requireUser();

  const { id: propertyId } = await params;
  const sp = await searchParams;

  const returnTo = sp.returnTo ?? `/properties/${propertyId}/ledger`;

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, type: true, name: true },
  });

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, marginBottom: 6 }}>Add transaction</h1>
          <div className="ll_muted">Create a new ledger entry.</div>
        </div>

        <Link className="ll_btnSecondary" href={returnTo}>
          Back
        </Link>
      </div>

      <div className="ll_card" style={{ marginTop: 16 }}>
        <NewTransactionForm
          propertyId={propertyId}
          returnTo={returnTo}
          categories={categories}
          defaultDateYmd={todayUtcYmd()}
        />
      </div>
    </div>
  );
}
