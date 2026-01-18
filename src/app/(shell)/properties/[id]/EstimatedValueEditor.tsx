"use client";

import { useState } from "react";

type Props = {
  propertyId: string;

  initialZillowUrl: string;
  initialRedfinUrl: string;

  initialZillowValueDollars: string;
  initialRedfinValueDollars: string;

  initialZillowUpdatedAtIso?: string | null;
  initialRedfinUpdatedAtIso?: string | null;
};

function safeIsoDate(iso?: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export default function EstimatedValueEditor(props: Props) {
  const [zillowValue, setZillowValue] = useState(props.initialZillowValueDollars ?? "");
  const [redfinValue, setRedfinValue] = useState(props.initialRedfinValueDollars ?? "");

  const [zillowUrl, setZillowUrl] = useState(props.initialZillowUrl ?? "");
  const [redfinUrl, setRedfinUrl] = useState(props.initialRedfinUrl ?? "");

  const [savingZillow, setSavingZillow] = useState(false);
  const [savingRedfin, setSavingRedfin] = useState(false);
  const [savingZillowLink, setSavingZillowLink] = useState(false);
  const [savingRedfinLink, setSavingRedfinLink] = useState(false);

  const [msgZillow, setMsgZillow] = useState("");
  const [msgRedfin, setMsgRedfin] = useState("");

  const [zillowUpdated, setZillowUpdated] = useState(safeIsoDate(props.initialZillowUpdatedAtIso));
  const [redfinUpdated, setRedfinUpdated] = useState(safeIsoDate(props.initialRedfinUpdatedAtIso));

  async function patchJson(url: string, payload: unknown) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      let err = "Request failed";
      try {
        const data = (await res.json()) as { error?: string };
        if (data?.error) err = data.error;
      } catch {
        // ignore
      }
      throw new Error(err);
    }

    return res.json();
  }

  async function saveLinks() {
    await patchJson(`/api/properties/${props.propertyId}/links`, {
      zillowUrl: zillowUrl.trim(),
      redfinUrl: redfinUrl.trim(),
    });
  }

  async function saveZillowValue() {
    await patchJson(`/api/properties/${props.propertyId}/zillow-estimated-value`, {
      estimatedValue: zillowValue,
    });
  }

  async function clearZillowValue() {
    await patchJson(`/api/properties/${props.propertyId}/zillow-estimated-value`, {
      estimatedValue: "",
    });
    setZillowValue("");
  }

  async function saveRedfinValue() {
    await patchJson(`/api/properties/${props.propertyId}/redfin-estimated-value`, {
      estimatedValue: redfinValue,
    });
  }

  async function clearRedfinValue() {
    await patchJson(`/api/properties/${props.propertyId}/redfin-estimated-value`, {
      estimatedValue: "",
    });
    setRedfinValue("");
  }

  const zillowHref = zillowUrl.trim();
  const redfinHref = redfinUrl.trim();

  return (
    <div className="flex flex-col gap-4">
      {/* Zillow */}
      <div className="ll_card">
        <div className="flex items-center gap-3">
          {zillowHref ? (
            <a
              href={zillowHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ll_card_title hover:underline"
              title="Open on Zillow"
              suppressHydrationWarning
            >
              Zillow
            </a>
          ) : (
            <div className="ll_card_title">Zillow</div>
          )}
          <div className="ll_spacer" />
          {zillowUpdated ? <div className="ll_muted">Updated: {zillowUpdated}</div> : null}
        </div>

        <div className="mt-3 ll_stack ll_gap_md">
          <div className="ll_stack ll_gap_sm">
            <div className="ll_muted">Estimate</div>
            <div className="ll_row ll_gap_sm items-center">
              <input
                className="ll_input flex-1"
                inputMode="numeric"
                placeholder='Whole dollars, e.g. 350000 or "$350,000"'
                value={zillowValue}
                onChange={(e) => setZillowValue(e.target.value)}
                suppressHydrationWarning
              />
              <button
                className="ll_btn ll_btnPrimary"
                onClick={async () => {
                  setMsgZillow("");
                  setSavingZillow(true);
                  try {
                    await saveZillowValue();
					setZillowUpdated(new Date().toISOString().slice(0, 10));
                    setMsgZillow("Saved.");
                  } catch (e) {
                    setMsgZillow(e instanceof Error ? e.message : "Failed to save.");
                  } finally {
                    setSavingZillow(false);
                  }
                }}
                disabled={savingZillow}
                type="button"
                suppressHydrationWarning
              >
                {savingZillow ? "Saving..." : "Save"}
              </button>
              <button
                className="ll_btn ll_btnDanger"
                onClick={async () => {
                  setMsgZillow("");
                  setSavingZillow(true);
                  try {
                    await clearZillowValue();
                    setMsgZillow("Cleared.");
                  } catch (e) {
                    setMsgZillow(e instanceof Error ? e.message : "Failed to clear.");
                  } finally {
                    setSavingZillow(false);
                  }
                }}
                disabled={savingZillow}
                type="button"
                suppressHydrationWarning
              >
                Clear
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          <div className="ll_stack ll_gap_sm">
            <div className="ll_muted">Link</div>
            <div className="ll_row ll_gap_sm items-center">
              <input
                className="ll_input flex-1"
                placeholder="https://www.zillow.com/..."
                value={zillowUrl}
                onChange={(e) => setZillowUrl(e.target.value)}
                suppressHydrationWarning
              />
              <button
                className="ll_btn ll_btnPrimary"
                onClick={async () => {
                  setMsgZillow("");
                  setSavingZillowLink(true);
                  try {
                    await saveLinks();
                    setMsgZillow("Link saved.");
                  } catch (e) {
                    setMsgZillow(e instanceof Error ? e.message : "Failed to save link.");
                  } finally {
                    setSavingZillowLink(false);
                  }
                }}
                disabled={savingZillowLink}
                type="button"
                suppressHydrationWarning
              >
                {savingZillowLink ? "Saving..." : "Save link"}
              </button>
            </div>
          </div>

          {msgZillow ? <div className="ll_muted">{msgZillow}</div> : null}
        </div>
      </div>

      {/* Redfin */}
      <div className="ll_card">
        <div className="flex items-center gap-3">
          {redfinHref ? (
            <a
              href={redfinHref}
              target="_blank"
              rel="noopener noreferrer"
              className="ll_card_title hover:underline"
              title="Open on Redfin"
              suppressHydrationWarning
            >
              Redfin
            </a>
          ) : (
            <div className="ll_card_title">Redfin</div>
          )}
          <div className="ll_spacer" />
          {redfinUpdated ? <div className="ll_muted">Updated: {redfinUpdated}</div> : null}
        </div>

        <div className="mt-3 ll_stack ll_gap_md">
          <div className="ll_stack ll_gap_sm">
            <div className="ll_muted">Estimate</div>
            <div className="ll_row ll_gap_sm items-center">
              <input
                className="ll_input flex-1"
                inputMode="numeric"
                placeholder='Whole dollars, e.g. 350000 or "$350,000"'
                value={redfinValue}
                onChange={(e) => setRedfinValue(e.target.value)}
                suppressHydrationWarning
              />
              <button
                className="ll_btn ll_btnPrimary"
                onClick={async () => {
                  setMsgRedfin("");
                  setSavingRedfin(true);
                  try {
                    await saveRedfinValue();
					setRedfinUpdated(new Date().toISOString().slice(0, 10));
                    setMsgRedfin("Saved.");
                  } catch (e) {
                    setMsgRedfin(e instanceof Error ? e.message : "Failed to save.");
                  } finally {
                    setSavingRedfin(false);
                  }
                }}
                disabled={savingRedfin}
                type="button"
                suppressHydrationWarning
              >
                {savingRedfin ? "Saving..." : "Save"}
              </button>
              <button
                className="ll_btn ll_btnDanger"
                onClick={async () => {
                  setMsgRedfin("");
                  setSavingRedfin(true);
                  try {
                    await clearRedfinValue();
                    setMsgRedfin("Cleared.");
                  } catch (e) {
                    setMsgRedfin(e instanceof Error ? e.message : "Failed to clear.");
                  } finally {
                    setSavingRedfin(false);
                  }
                }}
                disabled={savingRedfin}
                type="button"
                suppressHydrationWarning
              >
                Clear
              </button>
            </div>
          </div>

          <div className="border-t border-gray-200" />

          <div className="ll_stack ll_gap_sm">
            <div className="ll_muted">Link</div>
            <div className="ll_row ll_gap_sm items-center">
              <input
                className="ll_input flex-1"
                placeholder="https://www.redfin.com/..."
                value={redfinUrl}
                onChange={(e) => setRedfinUrl(e.target.value)}
                suppressHydrationWarning
              />
              <button
                className="ll_btn ll_btnPrimary"
                onClick={async () => {
                  setMsgRedfin("");
                  setSavingRedfinLink(true);
                  try {
                    await saveLinks();
                    setMsgRedfin("Link saved.");
                  } catch (e) {
                    setMsgRedfin(e instanceof Error ? e.message : "Failed to save link.");
                  } finally {
                    setSavingRedfinLink(false);
                  }
                }}
                disabled={savingRedfinLink}
                type="button"
                suppressHydrationWarning
              >
                {savingRedfinLink ? "Saving..." : "Save link"}
              </button>
            </div>
          </div>

          {msgRedfin ? <div className="ll_muted">{msgRedfin}</div> : null}
        </div>
      </div>
    </div>
  );
}
