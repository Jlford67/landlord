"use client";

import { useEffect, useRef, useState } from "react";

type PropertyManagerAddContactPanelClientProps = {
  companyId: string;
  defaultCollapsed: boolean;
  action: (formData: FormData) => void;
};

export default function PropertyManagerAddContactPanelClient({
  companyId,
  defaultCollapsed,
  action,
}: PropertyManagerAddContactPanelClientProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCollapsed(defaultCollapsed);
  }, [defaultCollapsed]);

  useEffect(() => {
    if (!collapsed) {
      requestAnimationFrame(() => {
        document.getElementById("newContactName")?.focus();
      });
    }
  }, [collapsed]);

  if (collapsed) {
    return (
      <>
        <div className="ll_notice">Contact saved.</div>
        <button
          type="button"
          className="ll_btn ll_btnLink"
          onClick={() => setCollapsed(false)}
        >
          + Add another contact
        </button>
      </>
    );
  }

  return (
    <form className="ll_form" action={action} suppressHydrationWarning data-company-id={companyId}>
      <label className="ll_label" htmlFor="newContactName">
        Name
      </label>
      <input
        ref={nameRef}
        id="newContactName"
        name="contactName"
        className="ll_input"
        placeholder="Contact name"
        required
        suppressHydrationWarning
      />

      <label className="ll_label" htmlFor="contactPhone">
        Phone
      </label>
      <input
        id="contactPhone"
        name="contactPhone"
        className="ll_input"
        placeholder="555-123-4567"
        suppressHydrationWarning
      />

      <label className="ll_label" htmlFor="contactEmail">
        Email
      </label>
      <input
        id="contactEmail"
        name="contactEmail"
        className="ll_input"
        placeholder="name@email.com"
        suppressHydrationWarning
      />

      <label className="ll_label" htmlFor="contactNotes">
        Notes
      </label>
      <textarea
        id="contactNotes"
        name="contactNotes"
        className="ll_input resize-none"
        rows={2}
        suppressHydrationWarning
      />

      <div className="ll_actions">
        <button className="ll_btn ll_btnPrimary" type="submit" suppressHydrationWarning>
          Save new contact
        </button>
      </div>
    </form>
  );
}
