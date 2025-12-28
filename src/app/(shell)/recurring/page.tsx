import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";

export default async function RecurringPage() {
  await requireUser();

  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Recurring</h1>

      <div className="ll_muted" style={{ marginBottom: 16 }}>
        Pick a property to manage recurring transactions.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {properties.map((p) => (
          <Link
            key={p.id}
            className="ll_btnSecondary"
            href={`/properties/${p.id}/ledger`}
          >
            {propertyLabel(p)}
          </Link>
        ))}
      </div>
    </div>
  );
}
