import Link from "next/link";
import { notFound } from "next/navigation";
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

function inputDate(d?: Date | null) {
  if (!d) return "";
  const iso = new Date(d).toISOString();
  return iso.slice(0, 10);
}

export default async function EditPropertyManagerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const [manager, properties] = await Promise.all([
    prisma.propertyManager.findUnique({
      where: { id },
      include: {
        assignments: {
          orderBy: [{ startDate: "desc" }],
          take: 1,
          include: {
            property: {
              select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
            },
          },
        },
      },
    }),
    prisma.property.findMany({
      orderBy: [{ nickname: "asc" }],
      select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
    }),
  ]);

  if (!manager) notFound();

  const assignment = manager.assignments[0] ?? null;
  const cancelHref = assignment?.propertyId ? `/property-managers?propertyId=${assignment.propertyId}` : "/property-managers";

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Edit property manager</div>
            <div className="ll_muted">Update manager details.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={cancelHref}>
              Cancel
            </Link>
          </div>
        </div>

        <form className="ll_form" method="post" action={`/api/property-managers/${manager.id}`} style={{ marginTop: 14 }}>
          <input type="hidden" name="assignmentId" value={assignment?.id ?? ""} />

          <label className="ll_label" htmlFor="companyName">
            Company Name
          </label>
          <input
            id="companyName"
            name="companyName"
            className="ll_input"
            defaultValue={manager.companyName}
            required
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="contactName">
            Contact Name
          </label>
          <input
            id="contactName"
            name="contactName"
            className="ll_input"
            defaultValue={manager.contactName ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            name="email"
            className="ll_input"
            defaultValue={manager.email ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="phone">
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            className="ll_input"
            defaultValue={manager.phone ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="website">
            Website
          </label>
          <input
            id="website"
            name="website"
            className="ll_input"
            defaultValue={manager.website ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="address1">
            Address
          </label>
          <input
            id="address1"
            name="address1"
            className="ll_input"
            defaultValue={manager.address1 ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="city">
            City
          </label>
          <input id="city" name="city" className="ll_input" defaultValue={manager.city ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="state">
            State
          </label>
          <input id="state" name="state" className="ll_input" defaultValue={manager.state ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="zip">
            Zip
          </label>
          <input id="zip" name="zip" className="ll_input" defaultValue={manager.zip ?? ""} suppressHydrationWarning />

          <label className="ll_label" htmlFor="propertyId">
            Property (optional)
          </label>
          <select
            id="propertyId"
            name="propertyId"
            className="ll_input"
            defaultValue={assignment?.propertyId ?? ""}
            suppressHydrationWarning
          >
            <option value="">No property assignment</option>
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {propertyLabel(p)}
              </option>
            ))}
          </select>

          <label className="ll_label" htmlFor="startDate">
            Start Date
          </label>
          <input
            id="startDate"
            name="startDate"
            type="date"
            className="ll_input"
            defaultValue={inputDate(assignment?.startDate)}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="endDate">
            End Date
          </label>
          <input
            id="endDate"
            name="endDate"
            type="date"
            className="ll_input"
            defaultValue={inputDate(assignment?.endDate)}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="feeType">
            Fee Type
          </label>
          <select
            id="feeType"
            name="feeType"
            className="ll_input"
            defaultValue={assignment?.feeType ?? ""}
            suppressHydrationWarning
          >
            <option value="">Select fee type...</option>
            <option value="percent">Percent</option>
            <option value="flat">Flat</option>
          </select>

          <label className="ll_label" htmlFor="feeValue">
            Fee Value
          </label>
          <input
            id="feeValue"
            name="feeValue"
            type="number"
            step="0.01"
            className="ll_input"
            defaultValue={assignment?.feeValue ?? ""}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="notes">
            Assignment Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            className="ll_input"
            rows={3}
            defaultValue={assignment?.notes ?? ""}
            suppressHydrationWarning
          />

          <div className="ll_actions">
            <button className="ll_btn" type="submit" suppressHydrationWarning>
              Save changes
            </button>
            <Link className="ll_btnSecondary" href={cancelHref}>
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
