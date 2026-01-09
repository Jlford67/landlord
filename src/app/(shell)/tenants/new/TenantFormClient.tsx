"use client";

import Link from "next/link";

export default function TenantFormClient({
  returnTo,
}: {
  returnTo: string;
}) {
  return (
    <form
      className="ll_form"
      action="/api/tenants"
      method="post"
      data-lpignore="true"
    >
      <input type="hidden" name="returnTo" value={returnTo} />

      <div className="ll_field">
        <label className="ll_label" htmlFor="firstName">
          First name
        </label>
        <input
          id="firstName"
          className="ll_input"
          name="firstName"
          required
          autoComplete="given-name"
          data-lpignore="true"
        />
      </div>

      <div className="ll_field">
        <label className="ll_label" htmlFor="lastName">
          Last name
        </label>
        <input
          id="lastName"
          className="ll_input"
          name="lastName"
          required
          autoComplete="family-name"
          data-lpignore="true"
        />
      </div>

      <div className="ll_field">
        <label className="ll_label" htmlFor="email">
          Email (optional)
        </label>
        <input
          id="email"
          className="ll_input"
          name="email"
          type="email"
          autoComplete="email"
          data-lpignore="true"
        />
      </div>

      <div className="ll_field">
        <label className="ll_label" htmlFor="phone">
          Phone (optional)
        </label>
        <input
          id="phone"
          className="ll_input"
          name="phone"
          autoComplete="tel"
          data-lpignore="true"
        />
      </div>

      <div className="ll_field">
        <label className="ll_label" htmlFor="notes">
          Notes (optional)
        </label>
        <input id="notes" className="ll_input" name="notes" />
      </div>

      <div className="ll_row ll_gap_sm" style={{ marginTop: 10 }}>
        <button className="ll_btn" type="submit">
          Save tenant
        </button>

        <Link className="ll_btnSecondary" href={returnTo}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
