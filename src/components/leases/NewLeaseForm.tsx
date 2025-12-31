"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AddTenantButton from "@/components/AddTenantButton";
import TenantPicker from "@/components/TenantPicker";

type Tenant = { id: string; name: string };

export default function NewLeaseForm(props: {
  propertyId: string;
  backHref: string;
  actionHref: string;

  defaultStartDate: string;
  defaultEndDate: string;
  defaultRentAmount: string;
  defaultDueDay: number;
  defaultDeposit: string;
  defaultStatus: string;
  defaultManagedByPm: boolean;
  defaultNotes: string;

  returnToBasePath: string;
  initialSelectedTenants: Tenant[];
}) {
  const [mounted, setMounted] = useState(false);
  const [confirmOverlap, setConfirmOverlap] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // If server redirected us back with ?overlap=1, confirm with user (client-only)
  useEffect(() => {
    if (!mounted) return;

    const url = new URL(window.location.href);
    const isOverlap = url.searchParams.get("overlap") === "1";
    if (!isOverlap) return;

    const ok = window.confirm(
      "There is already a lease that overlaps this date range for this property.\n\nCreate this lease anyway?"
    );

    if (!ok) {
      // User cancelled: remove overlap=1 so we don't keep prompting
      url.searchParams.delete("overlap");
      window.history.replaceState({}, "", url.pathname + (url.search ? url.search : ""));
      return;
    }

    // User confirmed: set hidden flag and resubmit
    setConfirmOverlap(true);
    queueMicrotask(() => {
      const form = document.getElementById("leaseForm") as HTMLFormElement | null;
      form?.submit();
    });
  }, [mounted]);

  // Key fix: do NOT SSR the form markup (prevents LastPass hydration mismatch)
  if (!mounted) return null;

  return (
    <form
      id="leaseForm"
      className="ll_form"
      action={props.actionHref}
      method="post"
      autoComplete="off"
    >
      <input
        type="hidden"
        name="confirmOverlap"
        value={confirmOverlap ? "true" : "false"}
      />

      <label>
        Start date
        <input
          className="ll_input"
          type="date"
          name="startDate"
          defaultValue={props.defaultStartDate}
          required
        />
      </label>

      <label>
        End date (optional)
        <input
          className="ll_input"
          type="date"
          name="endDate"
          defaultValue={props.defaultEndDate}
        />
      </label>

      <label>
        Rent amount
        <input
          className="ll_input"
          type="number"
          step="0.01"
          name="rentAmount"
          defaultValue={props.defaultRentAmount}
          required
        />
      </label>

      <label>
        Due day (1-28)
        <input
          className="ll_input"
          type="number"
          min={1}
          max={28}
          name="dueDay"
          defaultValue={props.defaultDueDay}
          required
        />
      </label>

      <label>
        Deposit (optional)
        <input
          className="ll_input"
          type="number"
          step="0.01"
          name="deposit"
          defaultValue={props.defaultDeposit}
        />
      </label>

      <label>
        Status
        <select className="ll_input" name="status" defaultValue={props.defaultStatus}>
          <option value="upcoming">upcoming</option>
          <option value="active">active</option>
          <option value="ended">ended</option>
        </select>
      </label>

      <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <input
          type="checkbox"
          name="managedByPm"
          defaultChecked={props.defaultManagedByPm}
        />
        Managed by PM
      </label>

      <label>
        Notes (optional)
        <input className="ll_input" name="notes" defaultValue={props.defaultNotes} />
      </label>

      <div style={{ marginTop: 6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700 }}>Tenants</div>

          <AddTenantButton
            tenantsNewBaseHref="/tenants/new?returnTo="
            returnToBasePath={props.returnToBasePath}
            formId="leaseForm"
          />
        </div>

        <TenantPicker initialSelected={props.initialSelectedTenants} />
      </div>

      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <button className="ll_btn" type="submit">
          Create lease
        </button>
        <Link className="ll_btnSecondary" href={props.backHref}>
          Cancel
        </Link>
      </div>
    </form>
  );
}
