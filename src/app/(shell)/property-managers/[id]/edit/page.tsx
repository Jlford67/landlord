import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  createPropertyManagerContact,
  deletePropertyManagerContact,
  updatePropertyManagerCompany,
  updatePropertyManagerContact,
} from "../../actions";
import PropertyManagerAddContactPanelClient from "@/components/PropertyManagerAddContactPanelClient";

function propertyLabel(p: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return p.nickname?.trim() || `${p.street}, ${p.city}, ${p.state} ${p.zip}`;
}

type SearchParams = Record<string, string | string[] | undefined>;

export default async function EditPropertyManagerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const msg = typeof sp.msg === "string" ? sp.msg : "";
  const contactId = typeof sp.contactId === "string" ? sp.contactId : "";

  const company = await prisma.propertyManagerCompany.findUnique({
    where: { id },
    include: {
      contacts: { orderBy: [{ name: "asc" }] },
      assignments: {
        orderBy: [{ property: { nickname: "asc" } }],
        include: {
          property: { select: { id: true, nickname: true, street: true, city: true, state: true, zip: true } },
          contact: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!company) notFound();

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Edit property manager</div>
            <div className="ll_muted">Update company details and contacts.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href="/property-managers">
              Cancel
            </Link>
          </div>
        </div>

        {msg === "updated" && <div className="ll_notice">Company updated.</div>}
        {msg === "contact-added" && <div className="ll_notice">Contact added.</div>}
        {msg === "contact-updated" && <div className="ll_notice">Contact updated.</div>}
        {msg === "contact-deleted" && <div className="ll_notice">Contact removed.</div>}

        <form className="ll_form" action={updatePropertyManagerCompany.bind(null, company.id)} style={{ marginTop: 14 }}>
          <label className="ll_label" htmlFor="name">
            Company Name
          </label>
          <input
            id="name"
            name="name"
            className="ll_input"
            defaultValue={company.name}
            required
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="phone">
            Phone
          </label>
          <input id="phone" name="phone" className="ll_input" defaultValue={company.phone ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" className="ll_input" defaultValue={company.email ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="website">
            Website
          </label>
          <input id="website" name="website" className="ll_input" defaultValue={company.website ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="address1">
            Address
          </label>
          <input id="address1" name="address1" className="ll_input" defaultValue={company.address1 ?? ""} suppressHydrationWarning />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px", gap: 10 }}>
            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="city">
                City
              </label>
              <input id="city" name="city" className="ll_input" defaultValue={company.city ?? ""} suppressHydrationWarning />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="state">
                State
              </label>
              <input id="state" name="state" className="ll_input" defaultValue={company.state ?? ""} suppressHydrationWarning />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="zip">
                Zip
              </label>
              <input id="zip" name="zip" className="ll_input" defaultValue={company.zip ?? ""} suppressHydrationWarning />
            </div>
          </div>

          <label className="ll_label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            className="ll_input resize-none"
            rows={3}
            defaultValue={company.notes ?? ""}
            suppressHydrationWarning
          />

          <div className="ll_actions">
            <button className="ll_btn" type="submit" suppressHydrationWarning>
              Save company
            </button>
            <Link className="ll_btnSecondary" href="/property-managers">
              Cancel
            </Link>
          </div>
        </form>

        <div className="ll_divider" />
        <div className="ll_card_title" style={{ fontSize: 14 }}>
          Add contact
        </div>

        <PropertyManagerAddContactPanelClient
          defaultCollapsed={msg === "contact-added"}
          action={createPropertyManagerContact.bind(null, company.id)}
        />

        <div className="ll_card_title mt-6" style={{ fontSize: 14 }}>
          Contacts
        </div>

        <div className="mt-3 space-y-3">
          {company.contacts.length ? (
            company.contacts.map((contact) => (
              <div key={contact.id} className="ll_card">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-900">Contact: {contact.name}</div>
                  {msg === "contact-updated" && contactId === contact.id ? (
                    <div className="text-xs text-green-700">Saved</div>
                  ) : null}
                </div>
                <form
                  className="ll_form"
                  action={updatePropertyManagerContact.bind(null, contact.id, company.id)}
                  style={{ margin: 0 }}
                >
                  <label className="ll_label" htmlFor={`contactName-${contact.id}`}>
                    Contact Name
                  </label>
                  <input
                    id={`contactName-${contact.id}`}
                    name="contactName"
                    className="ll_input"
                    defaultValue={contact.name}
                    required
                    suppressHydrationWarning
                  />

                  <label className="ll_label" htmlFor={`contactPhone-${contact.id}`}>
                    Phone
                  </label>
                  <input
                    id={`contactPhone-${contact.id}`}
                    name="contactPhone"
                    className="ll_input"
                    defaultValue={contact.phone ?? ""}
                    suppressHydrationWarning
                  />

                  <label className="ll_label" htmlFor={`contactEmail-${contact.id}`}>
                    Email
                  </label>
                  <input
                    id={`contactEmail-${contact.id}`}
                    name="contactEmail"
                    className="ll_input"
                    defaultValue={contact.email ?? ""}
                    suppressHydrationWarning
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
                    suppressHydrationWarning
                  />

                  <div className="ll_actions">
                    <button className="ll_btn" type="submit" suppressHydrationWarning>
                      Save
                    </button>
                  </div>
                </form>
                <form action={deletePropertyManagerContact.bind(null, contact.id, company.id)} style={{ marginTop: 10 }}>
                  <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                    Remove
                  </button>
                </form>
              </div>
            ))
          ) : (
            <div className="ll_muted">No contacts yet.</div>
          )}
        </div>

        <div className="ll_divider" />
        <div className="ll_card_title" style={{ fontSize: 14 }}>
          Assigned properties
        </div>

        <div className="mt-3 space-y-2">
          {company.assignments.length ? (
            company.assignments.map((assignment) => (
              <div key={assignment.id} className="ll_card">
                <div className="text-sm">
                  <Link className="ll_btn ll_btnLink" href={`/properties/${assignment.property.id}`}>
                    {propertyLabel(assignment.property)}
                  </Link>
                </div>
                <div className="ll_muted text-sm">
                  {assignment.contact ? `Contact: ${assignment.contact.name}` : "No contact selected"}
                </div>
              </div>
            ))
          ) : (
            <div className="ll_muted">No properties assigned yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
