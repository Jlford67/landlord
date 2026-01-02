"use client";

type PropertyOption = {
  id: string;
  label: string;
};

const COOKIE_NAME = "ll_dashboard_propertyId";

export default function PropertyPicker({
  properties,
  selectedId,
}: {
  properties: PropertyOption[];
  selectedId: string | null;
}) {
  function onChange(value: string) {
    if (!value) {
      document.cookie = `${COOKIE_NAME}=; Path=/; Max-Age=0; SameSite=Lax`;
    } else {
      const maxAge = 60 * 60 * 24 * 180;
      document.cookie = `${COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
    }
  }

  return (
    <form method="GET" action="/dashboard" className="ll_dash_picker">
      <label className="ll_dash_pickerLabel" htmlFor="propertyId">
        Property
      </label>

      <select
        id="propertyId"
        name="propertyId"
        className="ll_dash_pickerSelect"
        defaultValue={selectedId ?? ""}
        onChange={(e) => {
          onChange(e.target.value);
          e.currentTarget.form?.submit();
        }}
      >
        <option value="">All properties</option>
        {properties.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </form>
  );
}
