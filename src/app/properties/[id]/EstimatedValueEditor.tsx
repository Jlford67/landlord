"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EstimatedValueEditor({
  propertyId,
  initialValueDollars,
}: {
  propertyId: string;
  initialValueDollars: string;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialValueDollars);
  const [status, setStatus] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function handleSave(nextValue: string) {
    setIsSaving(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/properties/${propertyId}/estimated-value`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ estimatedValue: nextValue }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to save");
      }

      router.refresh();
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <label style={{ minWidth: 120 }}>Estimated Value</label>
      <input
        className="ll_input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="$350,000"
        disabled={isSaving}
      />
      <button
        className="ll_btnSecondary"
        type="button"
        onClick={() => handleSave(value)}
        disabled={isSaving}
      >
        Save
      </button>
      <button
        className="ll_btnSecondary"
        type="button"
        onClick={() => {
          setValue("");
          handleSave("");
        }}
        disabled={isSaving}
      >
        Clear
      </button>
      {status ? <span style={{ marginLeft: 6, opacity: 0.8 }}>{status}</span> : null}
    </div>
  );
}
