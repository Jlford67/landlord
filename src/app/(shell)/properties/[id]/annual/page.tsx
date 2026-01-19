import { prisma } from "@/lib/db";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import PropertyHeader from "@/components/properties/PropertyHeader";
import { normalizeYear } from "@/lib/dateSelectors";
import AnnualCategoryAmountsClient from "./AnnualCategoryAmountsClient";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ year?: string }>;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);


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

export default async function PropertyAnnualPage(props: PageProps) {
  const { id: propertyId } = await props.params;
  const sp = await props.searchParams;

  const year = normalizeYear(sp.year, currentYearUtc());

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
    select: {
      id: true,
      amount: true,
      note: true,
      categoryId: true,
      propertyOwnershipId: true,
      category: { select: { name: true, type: true } },
      propertyOwnership: {
        select: {
          id: true,
          ownershipPct: true,
          entity: { select: { name: true } },
        },
      },
    },
    orderBy: [
      { category: { type: "asc" } },
      { category: { name: "asc" } },
      { propertyOwnershipId: "asc" },
    ],
  });

  const ownerships = await prisma.propertyOwnership.findMany({
    where: { propertyId },
    select: {
      id: true,
      ownershipPct: true,
      entity: { select: { name: true } },
    },
    orderBy: [{ startDate: "asc" }, { entity: { name: "asc" } }],
  });

  // ---- totals (amount is stored signed: income positive, expense negative) ----
  const incomeTotal = rows.filter((r) => r.amount > 0).reduce((s, r) => s + r.amount, 0);
  const expenseTotalAbs = rows
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount), 0);
  const net = incomeTotal - expenseTotalAbs;

  return (
    <div className="ll_page w-full max-w-none mx-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[32px] m-0 mb-1.5">Annual category amounts</h1>
          <div className="ll_muted">
            {propertyLabel(property)} • Annual totals by category (no monthly dates). This page does
            not affect Cash Flow monthly averages.
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              className="ll_btnSecondary"
              href={`/properties/${propertyId}/annual?year=${year - 1}`}
            >
              Prev year
            </Link>

            <form method="get" className="flex items-center gap-2">
              <input
                className="ll_input w-[120px]"
                name="year"
                type="number"
                defaultValue={year}
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
              href={`/properties/${propertyId}/annual?year=${year + 1}`}
            >
              Next year
            </Link>
          </div>
        </div>

        <div className="flex gap-2.5 items-center">
          <Link className="ll_btn" href="/properties">
            Back
          </Link>
          <Link
            className="ll_btnWarning"
            href={`/properties/${propertyId}/annual/new?year=${year}&view=annual`}
          >
            Add annual entry
          </Link>
        </div>
      </div>

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
          subtitle="Annual"
          kpis={[
            { label: "Income", value: money(incomeTotal) },
            { label: "Expenses", value: money(expenseTotalAbs), className: "ll_neg" },
            { label: "Net", value: money(net), className: net >= 0 ? "ll_pos" : "ll_neg" },
          ]}
        />
      </div>

      <AnnualCategoryAmountsClient
        propertyId={propertyId}
        year={year}
        categories={categories}
        ownerships={ownerships}
        rows={rows}
        totals={{ incomeTotal, expenseTotalAbs, net }}
      />
    </div>
  );
}
