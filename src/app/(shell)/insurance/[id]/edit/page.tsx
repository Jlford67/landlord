import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";
import MountedInsuranceForm from "@/components/insurance/MountedInsuranceForm";
import PremiumMoneyInput from "@/components/insurance/PremiumMoneyInput";

import fs from "node:fs/promises";
import path from "node:path";

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

function inputDate(d?: Date | null) {
  if (!d) return "";
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10);
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

export default async function EditInsurancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [policy, properties] = await Promise.all([
    prisma.insurancePolicy.findUnique({ where: { id } }),
    prisma.property.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
    }),
  ]);

  if (!policy) notFound();

  const selectedProperty = await prisma.property.findUnique({
    where: { id: policy.propertyId },
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  const photoSrc = selectedProperty ? await findPropertyPhotoSrc(selectedProperty.id) : null;

  const cancelHref = policy.propertyId ? `/insurance?propertyId=${policy.propertyId}` : "/insurance";

  return (
    <div className="ll_page">
      <div className="ll_panel" suppressHydrationWarning>
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Edit insurance policy</div>
            <div className="ll_muted">Update policy details.</div>
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

        <MountedInsuranceForm placeholderHeight={320}>
          <form className="ll_form" method="post" action={`/api/insurance/${policy.id}`} style={{ marginTop: 14 }}>
            <label className="ll_label" htmlFor="propertyId">
              Property
            </label>
            <select
              id="propertyId"
              name="propertyId"
              className="ll_input"
              required
              defaultValue={policy.propertyId}
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
            <input id="insurer" name="insurer" className="ll_input" defaultValue={policy.insurer ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="policyNum">
              Policy #
            </label>
            <input id="policyNum" name="policyNum" className="ll_input" defaultValue={policy.policyNum ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="agentName">
              Agent Name
            </label>
            <input id="agentName" name="agentName" className="ll_input" defaultValue={policy.agentName ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className="ll_input" defaultValue={policy.phone ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="premium">
              Premium
            </label>
            <PremiumMoneyInput
              id="premium"
              name="premium"
              className="ll_input"
              defaultValue={policy.premium ?? null}
            />

            <label className="ll_label" style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <input
                id="autoPayMonthly"
                name="autoPayMonthly"
                type="checkbox"
                defaultChecked={policy.autoPayMonthly ?? false}
                suppressHydrationWarning
              />
              AutoPay Monthly
            </label>

            <label className="ll_label" htmlFor="dueDate">
              Due Date
            </label>
            <input
              id="dueDate"
              name="dueDate"
              type="date"
              className="ll_input"
              defaultValue={inputDate(policy.dueDate)}
              suppressHydrationWarning
            />

            <label className="ll_label" htmlFor="paidDate">
              Paid Date
            </label>
            <input
              id="paidDate"
              name="paidDate"
              type="date"
              className="ll_input"
              defaultValue={inputDate(policy.paidDate)}
              suppressHydrationWarning
            />

            <label className="ll_label" htmlFor="webPortal">
              Web Portal URL
            </label>
            <input id="webPortal" name="webPortal" className="ll_input" defaultValue={policy.webPortal ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="allPolicies">
              All Policies URL
            </label>
            <input id="allPolicies" name="allPolicies" className="ll_input" defaultValue={policy.allPolicies ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="bank">
              Bank
            </label>
            <input id="bank" name="bank" className="ll_input" defaultValue={policy.bank ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="bankNumber">
              Bank Number
            </label>
            <input id="bankNumber" name="bankNumber" className="ll_input" defaultValue={policy.bankNumber ?? ""} suppressHydrationWarning />

            <label className="ll_label" htmlFor="loanRef">
              Loan Ref
            </label>
            <input id="loanRef" name="loanRef" className="ll_input" defaultValue={policy.loanRef ?? ""} suppressHydrationWarning />

            <div className="ll_muted" style={{ marginTop: -6, marginBottom: 10 }}>
              AutoPay Monthly policies are excluded from reminders.
            </div>

            <div className="ll_actions">
              <button className="ll_btnPrimary" type="submit" suppressHydrationWarning>
                Save changes
              </button>
              <Link className="ll_btn" href={cancelHref}>
                Cancel
              </Link>
            </div>
          </form>
        </MountedInsuranceForm>
      </div>
    </div>
  );
}
