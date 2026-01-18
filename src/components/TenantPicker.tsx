"use client";

import { useMemo, useState } from "react";

export type TenantLite = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
};

export default function TenantPicker({
  initialSelected,
}: {
  initialSelected: TenantLite[];
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantLite[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<TenantLite[]>(initialSelected);

  const selectedIds = useMemo(() => new Set(selected.map((t) => t.id)), [selected]);

  async function search(q: string) {
    const trimmed = q.trim();
    setQuery(q);

    if (trimmed.length < 2) {
      setResults([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/tenants/search?q=${encodeURIComponent(trimmed)}`, {
        method: "GET",
      });
      const json = await res.json();
      setResults(Array.isArray(json.tenants) ? json.tenants : []);
    } finally {
      setLoading(false);
    }
  }

  function addTenant(t: TenantLite) {
    if (selectedIds.has(t.id)) return;
    setSelected((prev) => [...prev, t]);
  }

  function removeTenant(id: string) {
    setSelected((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div style={{ marginTop: 8 }}>
      <label>
        Search tenants (name, email, phone)
        <input
          className="ll_input"
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Type at least 2 characters…"
        />
      </label>

      <div style={{ marginTop: 10 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Selected</div>

        {selected.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {selected.map((t) => (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  border: "1px solid var(--border)",
                  borderRadius: 10,
                  background: "#ffffff",
                }}
              >
                <div style={{ opacity: 0.92 }}>
                  <div style={{ fontWeight: 800 }}>
                    {t.lastName}, {t.firstName}
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{t.email || "—"}</div>
                </div>

                <button
                  type="button"
                  className="ll_btnDanger"
                  onClick={() => removeTenant(t.id)}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>No tenants selected.</div>
        )}

        {/* Hidden inputs submitted with the lease form */}
        {selected.map((t) => (
          <input key={t.id} type="hidden" name="tenantIds" value={t.id} />
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>
          Search results {loading ? "(loading…)" : ""}
        </div>

        {results.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {results.map((t) => {
              const already = selectedIds.has(t.id);
              return (
                <div
                  key={t.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    opacity: already ? 0.55 : 0.92,
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>
                      {t.lastName}, {t.firstName}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>{t.email || "—"}</div>
                  </div>

                  <button
                    type="button"
                    className="ll_btnWarning"
                    disabled={already}
                    onClick={() => addTenant(t)}
                  >
                    {already ? "Added" : "Add"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ opacity: 0.75 }}>
            {query.trim().length >= 2 ? "No matches." : "Start typing to search."}
          </div>
        )}
      </div>
    </div>
  );
}
