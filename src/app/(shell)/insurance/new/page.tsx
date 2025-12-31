import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

export default async function NewInsurancePage() {
  await requireUser();

  const properties = await prisma.property.findMany({
    orderBy: [{ nickname: "asc" }],
    select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
  });

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>New insurance policy</div>
            <div className="ll_muted">Create a policy and link it to a property.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href="/insurance">
              Cancel
            </Link>
          </div>
        </div>

        <form className="ll_form" method="post" action="/api/insurance" style={{ marginTop: 14 }}>
          <label className="ll_label" htmlFor="propertyId">
            Property
          </label>
          <select id="propertyId" name="propertyId" className="ll_input" required suppressHydrationWarning>
            <option value="">Select a property…</option>
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
            <button className="ll_btn" type="submit" suppressHydrationWarning>
              Save policy
            </button>
            <Link className="ll_btnSecondary" href="/insurance">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
