"use client";

import PropertyManagerAddContactPanelClient from "@/components/PropertyManagerAddContactPanelClient";

type Contact = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
};

type PropertyManagerContactsClientProps = {
  companyId: string;
  contacts: Contact[];
  msg: string;
  contactId: string;
};

export default function PropertyManagerContactsClient({
  companyId,
  contacts,
  msg,
  contactId,
}: PropertyManagerContactsClientProps) {
  return (
    <>
      <div className="ll_divider" />
      <div className="ll_card_title" style={{ fontSize: 14 }}>
        Add contact
      </div>

      <div className="ll_card" style={{ marginTop: 10 }}>
        <PropertyManagerAddContactPanelClient
          defaultCollapsed={msg === "contact-added"}
          actionUrl={`/api/property-managers/by-company/${companyId}/contacts`}
        />
      </div>

      <div className="ll_card_title mt-6" style={{ fontSize: 14 }}>
        Contacts
      </div>

      <div className="mt-3 space-y-3">
        {contacts.length ? (
          contacts.map((contact) => (
            <div key={contact.id} className="ll_card">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">Contact: {contact.name}</div>
                {msg === "contact-updated" && contactId === contact.id ? (
                  <div className="text-xs text-green-700">Saved</div>
                ) : null}
              </div>
              <form
                className="ll_form"
                action={`/api/property-managers/contacts/${contact.id}/update`}
                method="post"
                style={{ margin: 0 }}
              >
                <input type="hidden" name="companyId" value={companyId} />
                <label className="ll_label" htmlFor={`contactName-${contact.id}`}>
                  Contact Name
                </label>
                <input
                  id={`contactName-${contact.id}`}
                  name="contactName"
                  className="ll_input"
                  defaultValue={contact.name}
                  required
                />

                <label className="ll_label" htmlFor={`contactPhone-${contact.id}`}>
                  Phone
                </label>
                <input
                  id={`contactPhone-${contact.id}`}
                  name="contactPhone"
                  className="ll_input"
                  defaultValue={contact.phone ?? ""}
                />

                <label className="ll_label" htmlFor={`contactEmail-${contact.id}`}>
                  Email
                </label>
                <input
                  id={`contactEmail-${contact.id}`}
                  name="contactEmail"
                  className="ll_input"
                  defaultValue={contact.email ?? ""}
                />

                <label className="ll_label" htmlFor={`contactNotes-${contact.id}`}>
                  Notes
                </label>
                <textarea
                  id={`contactNotes-${contact.id}`}
                  name="contactNotes"
                  className="ll_input resize-none"
                  rows={2}
                  defaultValue={contact.notes ?? ""}
                />

                <div className="ll_actions">
                  <button className="ll_btn" type="submit">
                    Save
                  </button>
                </div>
              </form>
              <form
                action={`/api/property-managers/contacts/${contact.id}/delete`}
                method="post"
                style={{ marginTop: 10 }}
              >
                <input type="hidden" name="companyId" value={companyId} />
                <button className="ll_btnSecondary" type="submit">
                  Remove
                </button>
              </form>
            </div>
          ))
        ) : (
          <div className="ll_muted">No contacts yet.</div>
        )}
      </div>
    </>
  );
}
