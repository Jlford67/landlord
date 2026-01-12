import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createPropertyManagerCompany } from "../actions";
import PropertyManagerNewMount from "./PropertyManagerNewMount";

export default async function NewPropertyManagerPage() {
  await requireUser();

  return (
    <div className="ll_page">
  	<PropertyManagerNewMount>
        <div className="ll_panel">
          <div className="ll_topbar">
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>New property manager</div>
              <div className="ll_muted">Create a property manager company.</div>
            </div>
  
            <div className="ll_topbarRight">
              <Link className="ll_btnSecondary" href="/property-managers">
                Cancel
              </Link>
            </div>
          </div>
  
          <form className="ll_form" action={createPropertyManagerCompany} style={{ marginTop: 14 }}>
            <label className="ll_label" htmlFor="name">
              Company Name
            </label>
            <input id="name" name="name" className="ll_input" placeholder="Company" required suppressHydrationWarning />
  
            <label className="ll_label" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" className="ll_input" placeholder="555-123-4567" suppressHydrationWarning />
  
            <label className="ll_label" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" className="ll_input" placeholder="name@email.com" suppressHydrationWarning />
  
            <label className="ll_label" htmlFor="website">
              Website
            </label>
            <input id="website" name="website" className="ll_input" placeholder="https://" suppressHydrationWarning />
  
            <label className="ll_label" htmlFor="address1">
              Address
            </label>
            <input id="address1" name="address1" className="ll_input" placeholder="Street" suppressHydrationWarning />
  
            <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 10 }}>
              <div style={{ display: "grid" }}>
                <label className="ll_label" htmlFor="city">
                  City
                </label>
                <input id="city" name="city" className="ll_input" placeholder="City" suppressHydrationWarning />
              </div>
  
              <div style={{ display: "grid" }}>
                <label className="ll_label" htmlFor="state">
                  State
                </label>
                <input id="state" name="state" className="ll_input" placeholder="State" suppressHydrationWarning />
              </div>
  
              <div style={{ display: "grid" }}>
                <label className="ll_label" htmlFor="zip">
                  Zip
                </label>
                <input id="zip" name="zip" className="ll_input" placeholder="Zip" suppressHydrationWarning />
              </div>
            </div>
  
            <label className="ll_label" htmlFor="notes">
              Notes
            </label>
            <textarea id="notes" name="notes" className="ll_input" rows={3} suppressHydrationWarning />
  
            <div className="ll_actions">
              <button className="ll_btn" type="submit" suppressHydrationWarning>
                Save company
              </button>
              <Link className="ll_btnSecondary" href="/property-managers">
                Cancel
              </Link>
            </div>
          </form>
        </div>
	  </PropertyManagerNewMount>
    </div>
  );
}
