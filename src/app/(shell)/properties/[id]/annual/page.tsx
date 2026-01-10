import { prisma } from "@/lib/db";
import Link from "next/link";
import { redirect } from "next/navigation";
import { saveAnnualLine, deleteAnnualLine } from "./actions";
import { promises as fs } from "fs";
import path from "path";
import PropertyHeader from "@/components/properties/PropertyHeader";
import IconButton from "@/components/ui/IconButton";
import { Save, Trash2 } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const financeMoney = (n: number) => {
  const abs = Math.abs(n);
  const formatted = money(abs);

  if (n < 0) return <span className="ll_neg font-semibold">({formatted})</span>;
  return <span className="ll_pos font-semibold">{formatted}</span>;
};

function currentYearUtc() {
  return new Date().getUTCFullYear();
}

function propertyLabel(p: { nickname: string | null; street: string }) {
  return p.nickname && p.nickname.trim() ? p.nickname.trim() : p.street;
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

async function goToYear(formData: FormData) {
  "use server";
  const propertyId = String(formData.get("propertyId") ?? "");
  const year = Number(formData.get("year") ?? "");
  const y = Number.isFinite(year) ? Math.trunc(year) : NaN;
  if (!propertyId || !Number.isFinite(y)) return;
  redirect(`/properties/${propertyId}/annual?year=${y}`);
}

export default async function PropertyAnnualPage(props: PageProps) {
  const { id: propertyId } = await props.params;
  const sp = await props.searchParams;

  const yearRaw = Number(sp.year ?? currentYearUtc());
  const year = Number.isFinite(yearRaw) ? Math.trunc(yearRaw) : currentYearUtc();

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
      <div className="ll_card">
        <div className="ll_card_title">Property not found</div>
      </div>
    );
  }

  const photoSrc = await findPropertyPhotoSrc(propertyId);

  const categories = await prisma.category.findMany({
    where: { active: true, type: { in: ["income", "expense"] } },
    select: { id: true, name: true, type: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  const rows = await prisma.annualCategoryAmount.findMany({
    where: { propertyId, year },
    include: {
      category: { select: { name: true, type: true } },
      propertyOwnership: { include: { entity: { select: { name: true } } } },
    },
    orderBy: [
      { category: { type: "asc" } },
      { category: { name: "asc" } },
      { propertyOwnershipId: "asc" },
    ],
  });

  const ownerships = await prisma.propertyOwnership.findMany({
    where: { propertyId },
    include: { entity: { select: { name: true } } },
    orderBy: [{ startDate: "asc" }, { entity: { name: "asc" } }],
  });

  const ownershipLabel = (ownership: (typeof ownerships)[number] | null) => {
    if (!ownership) return "None";
    const pct = Number.isFinite(ownership.ownershipPct) ? ownership.ownershipPct : null;
    return pct ? `${ownership.entity.name} (${pct}%)` : ownership.entity.name;
  };

  // ---- totals (amount is stored signed: income positive, expense negative) ----
  const incomeTotal = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const expenseTotalAbs = rows
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount), 0);
  const net = incomeTotal - expenseTotalAbs;

  const nowYear = currentYearUtc();
  const yearsQuick = [year - 2, year - 1, year, year + 1, year + 2]
    .filter((y) => y <= nowYear)
    .filter((y, i, a) => a.indexOf(y) === i);

  return (
    <div className="ll_stack">
      <div className="ll_card">
        <div className="ll_card_title">Annual category amounts</div>
        <div className="ll_muted">
          {propertyLabel(property)} • Annual totals by category (no monthly dates). This page does not
          affect Cash Flow monthly averages.
        </div>

        <div className="ll_row ll_gap_sm mt-1 items-start">
          {/* Year controls */}
          <div className="ll_row ll_gap_sm flex-wrap">
            <span className="ll_label">Year</span>

            {yearsQuick.map((y) => (
              <Link
                key={y}
                className={`ll_btn ${y === year ? "ll_btn_primary" : ""}`}
                href={`/properties/${propertyId}/annual?year=${y}`}
              >
                {y}
              </Link>
            ))}

            <form action={goToYear} className="ll_row ll_gap_sm">
              <input type="hidden" name="propertyId" value={propertyId} />
              <input
                name="year"
                className="ll_input w-[110px]"
                inputMode="numeric"
                placeholder="Go to year"
                defaultValue={year}
                suppressHydrationWarning
                data-lpignore="true"
              />
              <button className="ll_btn" type="submit" suppressHydrationWarning data-lpignore="true">
                Go
              </button>
            </form>
          </div>

          <div className="ll_spacer" />

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
            subtitle="Annual"
            kpis={[
              { label: "Income", value: money(incomeTotal) },
              { label: "Expenses", value: money(expenseTotalAbs), className: "ll_neg" },
              { label: "Net", value: money(net), className: net >= 0 ? "ll_pos" : "ll_neg" },
            ]}
          />
        </div>
      </div>

      <div className="ll_card">
        <div className="ll_card_title">Add or update a line</div>

        <form action={saveAnnualLine} className="ll_row ll_gap_sm flex-wrap">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="year" value={year} />

          <select
            name="categoryId"
            className="ll_input"
            required
            defaultValue=""
            suppressHydrationWarning
            data-lpignore="true"
          >
            <option value="" disabled>
              Select category…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.type === "expense" ? "Expense" : "Income"} • {c.name}
              </option>
            ))}
          </select>

          <input
            name="amountAbs"
            className="ll_input"
            placeholder="Amount (enter positive)"
            inputMode="decimal"
            required
            suppressHydrationWarning
            data-lpignore="true"
          />

          {ownerships.length > 0 ? (
            <select
              name="propertyOwnershipId"
              className="ll_input"
              defaultValue={ownerships.length === 1 ? ownerships[0]?.id ?? "" : ""}
              suppressHydrationWarning
              data-lpignore="true"
            >
              <option value="">Ownership: None</option>
              {ownerships.map((o) => (
                <option key={o.id} value={o.id}>
                  {ownershipLabel(o)}
                </option>
              ))}
            </select>
          ) : (
            <input type="hidden" name="propertyOwnershipId" value="" />
          )}

          <input
            name="note"
            className="ll_input"
            placeholder="Note (optional)"
            suppressHydrationWarning
            data-lpignore="true"
          />

          <IconButton
            className="ll_btn ll_btn_primary"
            type="submit"
            ariaLabel="Save"
            title="Save"
            icon={<Save size={18} />}
          />
        </form>

        <div className="ll_muted mt-2">
          Expense categories are stored as negative amounts automatically (same convention as
          transactions).
        </div>
      </div>

      <div className="ll_card">
        <div className="flex items-center justify-between">
          <div className="ll_card_title">Lines for {year}</div>

          <div className="flex items-center gap-2">
            <a className="ll_btn" href={`/api/properties/${propertyId}/annual/export?year=${year}`}>
              Export CSV
            </a>

            <a
              className="ll_btn"
              href={`/api/properties/${propertyId}/annual/export?mode=all`}
              title="Exports all annual rows for this property across all years"
            >
              Export All
            </a>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="ll_muted mt-2">No annual lines yet for this year.</div>
        ) : (
          <div className="ll_table_wrap mt-3">
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th className="w-[40%]">Category</th>
                  <th className="w-[15%]">Type</th>
                  <th className="w-[15%]">Amount</th>
                  <th className="w-[15%]">Ownership</th>
                  <th>Note</th>
                  <th className="w-px" />
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const amt = r.amount; // signed: income +, expense -
                  return (
                    <tr key={r.id}>
                      <td>{r.category.name}</td>
                      <td>{r.category.type}</td>
                      <td className="tabular-nums text-right">{financeMoney(amt)}</td>
                      <td>{ownershipLabel(r.propertyOwnership)}</td>
                      <td>{r.note ?? ""}</td>
                      <td>
                        <form action={deleteAnnualLine}>
                          <input type="hidden" name="propertyId" value={propertyId} />
                          <input type="hidden" name="year" value={year} />
                          <input type="hidden" name="id" value={r.id} />
                          <IconButton
                            className="ll_btn ll_btnLink"
                            type="submit"
                            ariaLabel={`Delete ${r.category.name} (${year})`}
                            title="Delete"
                            icon={<Trash2 size={18} className="text-red-600" />}
                          />
                        </form>
                      </td>
                    </tr>
                  );
                })}

                <tr className="ll_table_total">
                  <td className="font-semibold">Total Income</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">{financeMoney(incomeTotal)}</td>
                  <td />
                  <td />
                </tr>

                <tr className="ll_table_total">
                  <td className="font-semibold">Total Expenses</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">
                    {financeMoney(-expenseTotalAbs)}
                  </td>
                  <td />
                  <td />
                </tr>

                <tr className="ll_table_total">
                  <td className="font-semibold">Net</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">{financeMoney(net)}</td>
                  <td className="ll_muted">Matches the KPI totals above</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
