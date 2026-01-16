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

export default async function NewInsurancePage({
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

  const cancelHref = propertyId ? `/insurance?propertyId=${propertyId}` : "/insurance";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>New insurance policy</div>
            <div className="ll_muted">Create a policy and link it to a property.</div>
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
              subtitle="Insurance"
            />
          </div>
        ) : null}

        <form className="ll_form" method="post" action="/api/insurance" style={{ marginTop: 14 }}>
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

          <label className="ll_label" htmlFor="insurer">
            Insurer
          </label>
          <input id="insurer" name="insurer" className="ll_input" placeholder="Company" suppressHydrationWarning />

          <label className="ll_label" htmlFor="policyNum">
            Policy #
          </label>
          <input id="policyNum" name="policyNum" className="ll_input" placeholder="12345" suppressHydrationWarning />

          <label className="ll_label" htmlFor="agentName">
            Agent Name
          </label>
          <input
            id="agentName"
            name="agentName"
            className="ll_input"
            placeholder="Person or contact"
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="ll_input" placeholder="555-123-4567" suppressHydrationWarning />

          <label className="ll_label" htmlFor="premium">
            Premium
          </label>
          <input
            id="premium"
            name="premium"
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

          <label className="ll_label" htmlFor="paidDate">
            Paid Date
          </label>
          <input id="paidDate" name="paidDate" type="date" className="ll_input" suppressHydrationWarning />

          <label className="ll_label" htmlFor="webPortal">
            Web Portal URL
          </label>
          <input id="webPortal" name="webPortal" className="ll_input" placeholder="https://" suppressHydrationWarning />

          <label className="ll_label" htmlFor="allPolicies">
            All Policies URL
          </label>
          <input id="allPolicies" name="allPolicies" className="ll_input" placeholder="https://" suppressHydrationWarning />

          <label className="ll_label" htmlFor="bank">
            Bank
          </label>
          <input id="bank" name="bank" className="ll_input" placeholder="Bank name" suppressHydrationWarning />

          <label className="ll_label" htmlFor="bankNumber">
            Bank Number
          </label>
          <input id="bankNumber" name="bankNumber" className="ll_input" placeholder="Account number" suppressHydrationWarning />

          <label className="ll_label" htmlFor="loanRef">
            Loan Ref
          </label>
          <input id="loanRef" name="loanRef" className="ll_input" placeholder="Reference" suppressHydrationWarning />

          <div className="ll_actions">
            <button className="ll_btnPrimary" type="submit" suppressHydrationWarning>
              Save policy
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
