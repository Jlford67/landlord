"use client";

import React from "react";
import { useFormStatus } from "react-dom";
import { createTransaction } from "./actions";

type CategoryOption = { id: string; type: "income" | "expense" | "transfer"; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="ll_btnPrimary" disabled={pending} suppressHydrationWarning>
      {pending ? "Saving..." : "Save transaction"}
    </button>
  );
}

export default function NewTransactionForm(props: {
  propertyId: string;
  returnTo: string;
  categories: CategoryOption[];
  defaultDateYmd: string;
}) {
  return (
    <form action={createTransaction} style={{ display: "grid", gap: 12 }}>
      <input type="hidden" name="propertyId" value={props.propertyId} />
      <input type="hidden" name="returnTo" value={props.returnTo} />

      <div style={{ display: "grid", gap: 6 }}>
        <label className="ll_label">Date</label>
        <input className="ll_input" type="date" name="date" defaultValue={props.defaultDateYmd} required />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="ll_label">Category</label>
        <select className="ll_input" name="categoryId" required defaultValue="">
          <option value="" disabled>
            Select a category...
          </option>
          {props.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.type.toUpperCase()} · {c.name}
            </option>
          ))}
        </select>
        <div className="ll_muted" style={{ marginTop: 4 }}>
          Amount sign is set automatically: income (+), expense (-). Transfers keep your sign.
        </div>
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="ll_label">Amount</label>
        <input className="ll_input" type="number" step="0.01" name="amount" placeholder="0.00" required />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="ll_label">Payee (optional)</label>
        <input className="ll_input" type="text" name="payee" placeholder="HOA, Utility, Tenant, etc." />
      </div>

      <div style={{ display: "grid", gap: 6 }}>
        <label className="ll_label">Memo (optional)</label>
        <input className="ll_input" type="text" name="memo" placeholder="Notes..." />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <SubmitButton />
      </div>
    </form>
  );
}
