import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function inputValue<T extends string | number | null | undefined>(value: T) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function inputMoneyFromCents(cents: number | null | undefined) {
  if (cents == null) return "";
  return (cents / 100).toFixed(2);
}

function inputDateValue(date: Date | null | undefined) {
  if (!date) return "";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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

          <div className="ll_divider" />
          <div className="ll_card_title" style={{ fontSize: 14 }}>
            Acquisition &amp; Sale
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="purchasePrice">
                Purchase price ($)
              </label>
              <input
                id="purchasePrice"
                name="purchasePrice"
                type="number"
                step="0.01"
                className="ll_input"
                defaultValue={inputMoneyFromCents(property.purchasePriceCents)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="purchaseDate">
                Purchase date
              </label>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                className="ll_input"
                defaultValue={inputDateValue(property.purchaseDate)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="soldPrice">
                Sold price ($)
              </label>
              <input
                id="soldPrice"
                name="soldPrice"
                type="number"
                step="0.01"
                className="ll_input"
                defaultValue={inputMoneyFromCents(property.soldPriceCents)}
                suppressHydrationWarning
              />
            </div>

            <div style={{ display: "grid" }}>
              <label className="ll_label" htmlFor="soldDate">
                Sold date
              </label>
              <input
                id="soldDate"
                name="soldDate"
                type="date"
                className="ll_input"
                defaultValue={inputDateValue(property.soldDate)}
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
