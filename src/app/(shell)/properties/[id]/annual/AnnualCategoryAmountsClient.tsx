"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save, Trash2, X } from "lucide-react";
import { deleteAnnualLine, saveAnnualLine, updateAnnualLine } from "./actions";

type Category = {
  id: string;
  name: string;
  type: "income" | "expense";
};

type Ownership = {
  id: string;
  ownershipPct: number | null;
  entity: { name: string };
};

type AnnualRow = {
  id: string;
  amount: number;
  note: string | null;
  categoryId: string;
  propertyOwnershipId: string | null;
  category: { name: string; type: "income" | "expense" };
  propertyOwnership: Ownership | null;
};

type Totals = {
  incomeTotal: number;
  expenseTotalAbs: number;
  net: number;
};

type Props = {
  propertyId: string;
  year: number;
  categories: Category[];
  ownerships: Ownership[];
  rows: AnnualRow[];
  totals: Totals;
};

const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);

const financeMoney = (n: number) => {
  const abs = Math.abs(n);
  const formatted = money(abs);

  if (n < 0) return <span className="ll_neg font-semibold">({formatted})</span>;
  return <span className="ll_pos font-semibold">{formatted}</span>;
};

export default function AnnualCategoryAmountsClient({
  propertyId,
  year,
  categories,
  ownerships,
  rows,
  totals,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [entryId, setEntryId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [amountAbs, setAmountAbs] = useState("");
  const [propertyOwnershipId, setPropertyOwnershipId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement | null>(null);
  const router = useRouter();

  const defaultOwnershipId = useMemo(() => {
    if (ownerships.length === 1) return ownerships[0]?.id ?? "";
    return "";
  }, [ownerships]);

  useEffect(() => {
    setMounted(true);
    setPropertyOwnershipId(defaultOwnershipId);
  }, [defaultOwnershipId]);

  const ownershipLabel = (ownership: Ownership | null) => {
    if (!ownership) return "None";
    const pct = Number.isFinite(ownership.ownershipPct) ? ownership.ownershipPct : null;
    return pct ? `${ownership.entity.name} (${pct}%)` : ownership.entity.name;
  };

  const resetForm = () => {
    setIsEditing(false);
    setEntryId("");
    setCategoryId("");
    setAmountAbs("");
    setPropertyOwnershipId(defaultOwnershipId);
    setNote("");
    setError(null);
  };

  const handleEdit = (row: AnnualRow) => {
    setIsEditing(true);
    setEntryId(row.id);
    setCategoryId(row.categoryId);
    setAmountAbs(Math.abs(row.amount).toString());
    setPropertyOwnershipId(row.propertyOwnershipId ?? "");
    setNote(row.note ?? "");
    setError(null);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formRef.current) return;
    setError(null);
    const formData = new FormData(formRef.current);

    startTransition(async () => {
      const result = isEditing ? await updateAnnualLine(formData) : await saveAnnualLine(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      resetForm();
      router.refresh();
    });
  };

  const actionButtonLabel = isEditing ? "Update" : "Save";

  return (
    <div className="grid grid-cols-1 gap-6 mt-4 items-start w-full">
      <div className="ll_card">
        <div className="ll_card_title">Add or update a line</div>

        <form ref={formRef} onSubmit={handleSubmit} className="ll_row ll_gap_sm flex-wrap">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="year" value={year} />
          {isEditing ? <input type="hidden" name="entryId" value={entryId} /> : null}

          {mounted ? (
            <select
              name="categoryId"
              className="ll_input"
              required
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              data-lpignore="true"
              data-1p-ignore
            >
              <option value="" disabled>
                Select category…
              </option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === "expense" ? "Expense" : "Income"} • {c.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="ll_input h-[38px] w-[240px]" />
          )}

          {mounted ? (
            <input
              name="amountAbs"
              className="ll_input"
              placeholder="Amount (enter positive)"
              inputMode="decimal"
              required
              value={amountAbs}
              onChange={(event) => setAmountAbs(event.target.value)}
              data-lpignore="true"
              data-1p-ignore
            />
          ) : (
            <div className="ll_input h-[38px] w-[200px]" />
          )}

          {ownerships.length > 0 ? (
            mounted ? (
              <select
                name="propertyOwnershipId"
                className="ll_input"
                value={propertyOwnershipId}
                onChange={(event) => setPropertyOwnershipId(event.target.value)}
                data-lpignore="true"
                data-1p-ignore
              >
                <option value="">Ownership: None</option>
                {ownerships.map((o) => (
                  <option key={o.id} value={o.id}>
                    {ownershipLabel(o)}
                  </option>
                ))}
              </select>
            ) : (
              <div className="ll_input h-[38px] w-[220px]" />
            )
          ) : (
            <input type="hidden" name="propertyOwnershipId" value="" />
          )}

          {mounted ? (
            <input
              name="note"
              className="ll_input"
              placeholder="Note (optional)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              data-lpignore="true"
              data-1p-ignore
            />
          ) : (
            <div className="ll_input h-[38px] w-[200px]" />
          )}

          {mounted ? (
            <div className="flex items-center gap-2">
              <button
                className="ll_btn ll_btnGhost"
                type="submit"
                disabled={isPending}
                data-lpignore="true"
                data-1p-ignore
              >
                <span className="inline-flex items-center gap-2">
                  <Save size={18} />
                  {actionButtonLabel}
                </span>
              </button>
              {isEditing ? (
                <button
                  className="ll_btnSecondary"
                  type="button"
                  onClick={resetForm}
                  data-lpignore="true"
                  data-1p-ignore
                >
                  <span className="inline-flex items-center gap-2">
                    <X size={16} />
                    Cancel
                  </span>
                </button>
              ) : null}
            </div>
          ) : (
            <div className="h-[38px] w-[140px] rounded-md bg-slate-100" />
          )}
        </form>

        {error ? <div className="text-sm text-red-600 mt-2">{error}</div> : null}

        <div className="ll_muted mt-2">
          Expense categories are stored as negative amounts automatically (same convention as
          transactions).
        </div>
      </div>

      <div className="ll_card">
        <div className="flex items-center justify-between">
          <div className="ll_card_title">Lines for {year}</div>

          <div className="flex items-center gap-2">
            <a
              className="ll_btnPrimary"
              href={`/api/properties/${propertyId}/annual/export?year=${year}`}
            >
              Export CSV
            </a>

            <a
              className="ll_btnPrimary"
              href={`/api/properties/${propertyId}/annual/export?mode=all`}
              title="Exports all annual rows for this property across all years"
            >
              Export All
            </a>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="ll_muted mt-2">No annual lines yet for this year.</div>
        ) : (
          <div className="ll_table_wrap mt-3">
            <table className="ll_table ll_table_zebra">
              <thead>
                <tr>
                  <th className="w-[40%]">Category</th>
                  <th className="w-[15%]">Type</th>
                  <th className="w-[15%]">Amount</th>
                  <th className="w-[15%]">Ownership</th>
                  <th>Note</th>
                  <th className="w-px" />
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const amt = r.amount; // signed: income +, expense -
                  return (
                    <tr key={r.id}>
                      <td>{r.category.name}</td>
                      <td>{r.category.type}</td>
                      <td className="tabular-nums text-right">{financeMoney(amt)}</td>
                      <td>{ownershipLabel(r.propertyOwnership)}</td>
                      <td>{r.note ?? ""}</td>
                      <td>
                        {mounted ? (
                          <div className="flex items-center gap-1">
                            <button
                              className="ll_btn ll_btnGhost"
                              type="button"
                              aria-label={`Edit ${r.category.name} (${year})`}
                              title="Edit"
                              onClick={() => handleEdit(r)}
                              data-lpignore="true"
                              data-1p-ignore
                            >
                              <Pencil size={18} />
                            </button>
                            <form action={deleteAnnualLine}>
                              <input type="hidden" name="propertyId" value={propertyId} />
                              <input type="hidden" name="year" value={year} />
                              <input type="hidden" name="id" value={r.id} />
                              <button
                                className="ll_btn ll_btnGhost"
                                type="submit"
                                aria-label={`Delete ${r.category.name} (${year})`}
                                title="Delete"
                                data-lpignore="true"
                                data-1p-ignore
                              >
                                <Trash2 size={18} className="text-red-600" />
                              </button>
                            </form>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <div className="h-[34px] w-[34px] rounded-md bg-slate-100" />
                            <div className="h-[34px] w-[34px] rounded-md bg-slate-100" />
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}

                <tr className="ll_table_total">
                  <td className="font-semibold">Total Income</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">
                    {financeMoney(totals.incomeTotal)}
                  </td>
                  <td />
                  <td />
                </tr>

                <tr className="ll_table_total">
                  <td className="font-semibold">Total Expenses</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">
                    {financeMoney(-totals.expenseTotalAbs)}
                  </td>
                  <td />
                  <td />
                </tr>

                <tr className="ll_table_total">
                  <td className="font-semibold">Net</td>
                  <td />
                  <td className="tabular-nums text-right font-semibold">
                    {financeMoney(totals.net)}
                  </td>
                  <td className="ll_muted">Matches the KPI totals above</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
