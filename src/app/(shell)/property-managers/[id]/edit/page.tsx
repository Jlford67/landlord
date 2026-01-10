import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  updatePropertyManagerCompany,
} from "../../actions";
import ClientOnly from "@/components/ClientOnly";
import PropertyManagerContactsClient from "@/components/PropertyManagerContactsClient";

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

  const contacts = company.contacts.map((contact) => ({
    id: contact.id,
    name: contact.name,
    phone: contact.phone ?? null,
    email: contact.email ?? null,
    notes: contact.notes ?? null,
  }));

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

        <ClientOnly fallback={<div className="ll_card">Loading contacts…</div>}>
          <PropertyManagerContactsClient
            companyId={company.id}
            contacts={contacts}
            msg={msg}
            contactId={contactId}
          />
        </ClientOnly>

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
