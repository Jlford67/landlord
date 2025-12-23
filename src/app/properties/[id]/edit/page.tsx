import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function inputValue<T extends string | number | null | undefined>(value: T) {
  if (value === null || value === undefined) return "";
  return String(value);
}

export default async function EditPropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;

  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_topbar">
          <div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Edit property</div>
            <div className="ll_muted">Update property details.</div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Cancel
            </Link>
          </div>
        </div>

        <form
          className="ll_form"
          method="post"
          action={`/api/properties/${property.id}`}
          style={{ marginTop: 14 }}
        >
          <label className="ll_label" htmlFor="nickname">
            Nickname
          </label>
          <input
            id="nickname"
            name="nickname"
            className="ll_input"
            defaultValue={inputValue(property.nickname)}
            suppressHydrationWarning
          />

          <label className="ll_label" htmlFor="street">
            Street
          </label>
          <input
            id="street"
            name="street"
            className="ll_input"
            required
            defaultValue={property.street}
            suppressHydrationWarning
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 140px", gap: 10 }}>
            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="city">
                City
              </label>
              <input
                id="city"
                name="city"
                className="ll_input"
                required
                defaultValue={property.city}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="state">
                State
              </label>
              <input
                id="state"
                name="state"
                className="ll_input"
                required
                defaultValue={property.state}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="zip">
                ZIP
              </label>
              <input
                id="zip"
                name="zip"
                className="ll_input"
                required
                defaultValue={property.zip}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="status">
                Status
              </label>
              <select
                id="status"
                name="status"
                className="ll_input"
                defaultValue={property.status}
                suppressHydrationWarning
              >
                <option value="active">Active</option>
                <option value="sold">Sold</option>
                <option value="watchlist">Watchlist</option>
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="doors">
                Doors
              </label>
              <input
                id="doors"
                name="doors"
                type="number"
                className="ll_input"
                defaultValue={inputValue(property.doors)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="beds">
                Beds
              </label>
              <input
                id="beds"
                name="beds"
                type="number"
                step="0.1"
                className="ll_input"
                defaultValue={inputValue(property.beds)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="baths">
                Baths
              </label>
              <input
                id="baths"
                name="baths"
                type="number"
                step="0.1"
                className="ll_input"
                defaultValue={inputValue(property.baths)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="sqFt">
                Sq Ft
              </label>
              <input
                id="sqFt"
                name="sqFt"
                type="number"
                className="ll_input"
                defaultValue={inputValue(property.sqFt)}
                suppressHydrationWarning
              />
            </div>
          </div>

          <label className="ll_label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            name="notes"
            className="ll_input"
            rows={3}
            defaultValue={inputValue(property.notes)}
            suppressHydrationWarning
          />

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Cancel
            </Link>
            <button className="ll_btn" type="submit" style={{ fontWeight: 800 }}>
              Save changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
