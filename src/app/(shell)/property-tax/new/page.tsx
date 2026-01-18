import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";

import fs from "node:fs/promises";
import path from "node:path";

function getStr(sp: Record<string, string | string[] | undefined>, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

async function findPropertyPhotoSrc(propertyId: string): Promise<string | null> {
  // Files live in /public/property-photos; URLs are /property-photos/<file>
  const dir = path.join(process.cwd(), "public", "property-photos");
  const candidates = [`${propertyId}.webp`, `${propertyId}.jpg`, `${propertyId}.jpeg`, `${propertyId}.png`];

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

type SearchParams = Record<string, string | string[] | undefined>;

export default async function NewPropertyTaxPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const sp = searchParams ? await searchParams : {};
  const propertyId = getStr(sp, "propertyId").trim();

  const properties = await prisma.property.findMany({
    orderBy: [{ nickname: "asc" }],
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  const selectedProperty = propertyId
    ? await prisma.property.findUnique({
        where: { id: propertyId },
        select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
      })
    : null;

  const photoSrc = selectedProperty ? await findPropertyPhotoSrc(selectedProperty.id) : null;

  const cancelHref = propertyId ? `/property-tax?propertyId=${propertyId}` : "/property-tax";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>New property tax account</div>
            <div className="ll_muted">Create a tax account and link it to a property.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btn" href={cancelHref}>
              Cancel
            </Link>
          </div>
        </div>

        {selectedProperty ? (
          <div className="mt-3">
            <PropertyHeader
              property={{
                id: selectedProperty.id,
                nickname: selectedProperty.nickname,
                street: selectedProperty.street,
                city: selectedProperty.city,
                state: selectedProperty.state,
                zip: selectedProperty.zip,
                photoUrl: photoSrc ?? null,
              }}
              href={`/properties/${selectedProperty.id}`}
              subtitle="Property tax"
            />
          </div>
        ) : null}

        <form className="ll_form" method="post" action="/api/property-tax" style={{ marginTop: 14 }}>
          <label className="ll_label" htmlFor="propertyId">
            Property
          </label>
          <select
            id="propertyId"
            name="propertyId"
            className="ll_input"
            required
            defaultValue={propertyId || ""}
            suppressHydrationWarning
          >
            <option value="">Select a property...</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {propertyLabel(p)}
              </option>
            ))}
          </select>

          <label className="ll_label" htmlFor="name">
            Billing Authority
          </label>
          <input id="name" name="name" className="ll_input" placeholder="County or agency" suppressHydrationWarning />

          <label className="ll_label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="ll_input" placeholder="555-123-4567" suppressHydrationWarning />

          <label className="ll_label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" className="ll_input" placeholder="name@email.com" suppressHydrationWarning />

          <label className="ll_label" htmlFor="web">
            Web Portal URL
          </label>
          <input id="web" name="web" className="ll_input" placeholder="https://" suppressHydrationWarning />

          <label className="ll_label" htmlFor="billNumber">
            Bill #
          </label>
          <input id="billNumber" name="billNumber" className="ll_input" placeholder="12345" suppressHydrationWarning />

          <label className="ll_label" htmlFor="parcel">
            Parcel #
          </label>
          <input id="parcel" name="parcel" className="ll_input" placeholder="Parcel number" suppressHydrationWarning />

          <label className="ll_label" htmlFor="annualAmount">
            Amount Due
          </label>
          <input
            id="annualAmount"
            name="annualAmount"
            type="number"
            step="0.01"
            className="ll_input"
            placeholder="0.00"
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="dueDate">
            Due Date
          </label>
          <input id="dueDate" name="dueDate" type="date" className="ll_input" suppressHydrationWarning />

          <label className="ll_label" htmlFor="lastPaid">
            Last Paid
          </label>
          <input id="lastPaid" name="lastPaid" type="date" className="ll_input" suppressHydrationWarning />

          <label className="ll_label" htmlFor="address1">
            Address 1
          </label>
          <input id="address1" name="address1" className="ll_input" placeholder="Street" suppressHydrationWarning />

          <label className="ll_label" htmlFor="address2">
            Address 2
          </label>
          <input id="address2" name="address2" className="ll_input" placeholder="Suite" suppressHydrationWarning />

          <label className="ll_label" htmlFor="city">
            City
          </label>
          <input id="city" name="city" className="ll_input" placeholder="City" suppressHydrationWarning />

          <label className="ll_label" htmlFor="state">
            State
          </label>
          <input id="state" name="state" className="ll_input" placeholder="State" suppressHydrationWarning />

          <label className="ll_label" htmlFor="zip">
            Zip
          </label>
          <input id="zip" name="zip" className="ll_input" placeholder="Zip" suppressHydrationWarning />

          <div className="ll_actions">
            <button className="ll_btnPrimary" type="submit" suppressHydrationWarning>
              Save tax account
            </button>
            <Link className="ll_btn" href={cancelHref}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
