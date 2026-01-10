import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { upsertAnnualEntry } from "../../actions";

function currentYearUtc() {
  return new Date().getUTCFullYear();
}

export default async function EditAnnualEntryPage(props: {
  params: Promise<{ id: string; annualId: string }>;
  searchParams?: Promise<{ year?: string }>;
}) {
  await requireUser();

  const { id: propertyId, annualId } = await props.params;
  const sp = (await props.searchParams) ?? {};
  const fallbackYear = Number.isFinite(Number(sp.year)) ? Math.trunc(Number(sp.year)) : currentYearUtc();

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  const entry = await prisma.annualCategoryAmount.findFirst({
    where: { id: annualId, propertyId },
    include: { category: { select: { id: true, name: true, type: true, parentId: true } } },
  });

  if (!property || !entry) {
    return (
      <div className="ll_page">
        <div className="ll_panel">
          <h1>Annual entry not found</h1>
          <Link className="ll_btnSecondary" href={`/properties/${propertyId}/ledger?view=annual&year=${fallbackYear}`}>
            Back to annual
          </Link>
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    where: { active: true, type: { in: ["income", "expense"] } },
    select: { id: true, name: true, type: true, parentId: true },
    orderBy: [{ type: "asc" }, { parentId: "asc" }, { name: "asc" }],
  });

  const ownerships = await prisma.propertyOwnership.findMany({
    where: { propertyId },
    include: { entity: { select: { name: true } } },
    orderBy: [{ startDate: "asc" }, { entity: { name: "asc" } }],
  });

  const categoryMap = new Map(
    categories.map((cat) => [cat.id, { name: cat.name, parentId: cat.parentId }])
  );

  const categoryLabel = (categoryId: string, fallback: string) => {
    const names: string[] = [];
    let cursor: string | null = categoryId;
    while (cursor) {
      const found = categoryMap.get(cursor);
      if (!found) break;
      names.unshift(found.name);
      cursor = found.parentId;
    }
    return names.length > 0 ? names.join(" › ") : fallback;
  };

  const ownershipLabel = (ownership: (typeof ownerships)[number]) => {
    const pct = Number.isFinite(ownership.ownershipPct) ? ownership.ownershipPct : null;
    return pct ? `${ownership.entity.name} (${pct}%)` : ownership.entity.name;
  };

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 16 }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1>Edit annual entry</h1>
            <div className="ll_muted">
              {property.nickname?.trim() || "(no nickname)"} • {property.street}, {property.city},{" "}
              {property.state} {property.zip}
            </div>
          </div>
          <div className="ll_topbarRight">
            <Link
              className="ll_btnSecondary"
              href={`/properties/${propertyId}/ledger?view=annual&year=${entry.year}`}
            >
              Back
            </Link>
          </div>
        </div>

        <form className="ll_form" action={upsertAnnualEntry}>
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="entryId" value={entry.id} />

          <div className="ll_grid2">
            <div>
              <label className="ll_label" htmlFor="year">
                Year
              </label>
              <input
                id="year"
                name="year"
                type="number"
                className="ll_input"
                defaultValue={entry.year}
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
                defaultValue={entry.categoryId}
                required
                suppressHydrationWarning
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.type.toUpperCase()} • {categoryLabel(c.id, c.name)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="ll_label" htmlFor="amountAbs">
                Amount
              </label>
              <input
                id="amountAbs"
                name="amountAbs"
                type="number"
                step="0.01"
                className="ll_input"
                defaultValue={Math.abs(entry.amount).toFixed(2)}
                required
                suppressHydrationWarning
              />
              <div className="ll_muted">We store it as income/expense based on the category.</div>
            </div>

            {ownerships.length > 0 ? (
              <div>
                <label className="ll_label" htmlFor="propertyOwnershipId">
                  Ownership
                </label>
                <select
                  id="propertyOwnershipId"
                  name="propertyOwnershipId"
                  className="ll_input"
                  defaultValue={entry.propertyOwnershipId ?? ""}
                  suppressHydrationWarning
                >
                  <option value="">None</option>
                  {ownerships.map((o) => (
                    <option key={o.id} value={o.id}>
                      {ownershipLabel(o)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="propertyOwnershipId" value="" />
            )}

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="ll_label" htmlFor="note">
                Note (optional)
              </label>
              <input
                id="note"
                name="note"
                className="ll_input"
                defaultValue={entry.note ?? ""}
                suppressHydrationWarning
              />
            </div>
          </div>

          <div className="ll_actions">
            <button className="ll_btn" type="submit" suppressHydrationWarning>
              Save changes
            </button>
            <Link
              className="ll_btnSecondary"
              href={`/properties/${propertyId}/ledger?view=annual&year=${entry.year}`}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
