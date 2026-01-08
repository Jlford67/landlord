"use client";

import { useMemo, useState, useEffect } from "react";

type CompanyOption = {
  id: string;
  name: string;
};

type ContactOption = {
  id: string;
  companyId: string;
  name: string;
  email: string | null;
  phone: string | null;
};

export default function PropertyManagerAssignmentFields({
  companies,
  contacts,
  initialCompanyId,
  initialContactId,
}: {
  companies: CompanyOption[];
  contacts: ContactOption[];
  initialCompanyId: string | null;
  initialContactId: string | null;
}) {
  const [companyId, setCompanyId] = useState(initialCompanyId ?? "");
  const [contactId, setContactId] = useState(initialContactId ?? "");

  const filteredContacts = useMemo(
    () => contacts.filter((contact) => contact.companyId === companyId),
    [contacts, companyId]
  );

  useEffect(() => {
    if (contactId && !filteredContacts.some((contact) => contact.id === contactId)) {
      setContactId("");
    }
  }, [contactId, filteredContacts]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <label className="ll_label">
        Company
        <select
          name="propertyManagerCompanyId"
          className="ll_input"
          value={companyId}
          onChange={(event) => setCompanyId(event.target.value)}
        >
          <option value="">No property manager</option>
          {companies.map((company) => (
            <option key={company.id} value={company.id}>
              {company.name}
            </option>
          ))}
        </select>
      </label>

      <label className="ll_label">
        Contact
        <select
          name="propertyManagerContactId"
          className="ll_input"
          value={contactId}
          onChange={(event) => setContactId(event.target.value)}
          disabled={!companyId}
        >
          <option value="">No contact</option>
          {filteredContacts.map((contact) => {
            const detail = [contact.email, contact.phone].filter(Boolean).join(" • ");
            return (
              <option key={contact.id} value={contact.id}>
                {detail ? `${contact.name} (${detail})` : contact.name}
              </option>
            );
          })}
        </select>
      </label>
    </div>
  );
}
