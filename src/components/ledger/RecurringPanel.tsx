"use client";

import React, { useTransition } from "react";
import { fmtMoney } from "@/lib/format";
import { useRouter } from "next/navigation";
import {
  createRecurringTransaction,
  updateRecurringTransaction,
  toggleRecurringTransaction,
  deleteRecurringTransaction,
  postRecurringForMonth,
  postRecurringCatchUp,
} from "@/app/(shell)/properties/[id]/ledger/recurringActions";

export type RecurringCategoryOption = {
  id: string;
  name: string;
  type: string;
};

export type RecurringItemDTO = {
  id: string;
  propertyId: string;
  categoryId: string | null;
  amountCents: number;
  dayOfMonth: number;
  isActive: boolean;
  memo: string | null;
  startMonth: string; // YYYY-MM
  endMonth: string | null; // YYYY-MM or null
  category: RecurringCategoryOption | null;
};

export type ScheduledRecurringDTO = {
  recurringId: string;
  categoryId: string | null;
  amountCents: number;
  dayOfMonth: number;
  name: string;
  alreadyPosted: boolean;
  category: RecurringCategoryOption | null;
};

export type RecurringPanelProps = {
  propertyId: string;
  month: string;
  categories: RecurringCategoryOption[];
  recurringTablesReady: boolean;
  recurringItems: RecurringItemDTO[];
  scheduledRecurring: ScheduledRecurringDTO[];
  msg?: string;
  msgDetail?: string;
  msgReason?: string;
  msgPosted?: string;
  recurringErrorMsg?: string | null;
};

export default function RecurringPanel(props: RecurringPanelProps) {
	
  const router = useRouter();
  const [postPending, startPost] = useTransition();

  const postForMonth = () => {
    startPost(async () => {
      const fd = new FormData();
      fd.set("propertyId", props.propertyId);
      fd.set("throughMonth", props.month);
  
      await postRecurringCatchUp(fd);
      router.refresh();
    });
  };

  const postRecurring = () => {
    startPost(async () => {
      const fd = new FormData();
      fd.set("propertyId", props.propertyId);
      fd.set("throughMonth", props.month); // catch up through the month you’re viewing
  
      await postRecurringCatchUp(fd);
      router.refresh();
    });
  };

  return (

  <div suppressHydrationWarning>
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
      <div>
        <h2 style={{ marginTop: 0, marginBottom: 6 }}>Recurring</h2>
        <div className="ll_muted" style={{ marginBottom: 10 }}>
          Set up monthly items like HOA. Post them into the ledger when ready.
        </div>
      </div>
    
      {props.recurringTablesReady ? (
        <button
          type="button"
          className="ll_btnPrimary"
          disabled={postPending}
          onClick={postForMonth}
          suppressHydrationWarning
        >
          {postPending ? "Posting..." : "Post Recurring"}
        </button>
      ) : null}
    </div>


    <div className="ll_notice" style={{ background: "rgba(0,0,0,0.04)", color: "#333" }}>
      Loaded categories: {props.categories.length}
      {props.categories.length === 0 ? (
        <span>
          {" "}
          • No categories found. Go to <a href="/categories">/categories</a> and add an EXPENSE category first.
        </span>
      ) : null}
    </div>

    {props.msg === "recurring_created" ? (
      <div className="ll_notice" style={{ background: "rgba(93, 211, 166, 0.12)", color: "#2e8b57" }}>
        Recurring item added.
      </div>
    ) : null}

    {props.msg === "recurring_error" ? (
      <div className="ll_notice" style={{ background: "rgba(255, 107, 107, 0.1)", color: "#ff6b6b" }}>
        Could not add recurring item: {friendlyRecurringError(props.msgDetail, props.msgReason)}
      </div>
    ) : null}

    {props.categories.length === 0 ? (
      <div className="ll_notice" style={{ background: "rgba(255, 193, 7, 0.12)", color: "#8a6d3b" }}>
        No categories available. Create categories first so you can assign recurring items.
      </div>
    ) : null}

    {props.recurringTablesReady ? (
      <>
        <div style={{ width: "100%" }}>
        <table className="ll_table recurringTable">
          <colgroup>
            <col style={{ width: "24%" }} />
            <col style={{ width: "16%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "12%" }} />
          </colgroup>

        
          <thead>
            <tr>
              <th className="rec_name">Name</th>
              <th className="rec_cat">Category</th>
              <th className="rec_amt" style={{ textAlign: "right" }}>Amount</th>
              <th className="rec_day" style={{ textAlign: "center" }}>Day</th>
              <th className="rec_range">Range</th>
              <th className="rec_status">Status</th>
              <th className="rec_actions" style={{ textAlign: "right" }}>Actions</th>
            </tr>
          </thead>


            <tbody>
              {props.recurringItems.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <div className="ll_muted">No recurring items yet.</div>
                  </td>
                </tr>
              ) : (
                props.recurringItems.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: "normal" }}>
                      {r.memo || r.category?.name || <span className="ll_muted">(none)</span>}
                    </td>
                    <td>{r.category?.name || <span className="ll_muted">(missing)</span>}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      {fmtMoney(r.amountCents / 100)}
                    </td>

                    <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                      {r.dayOfMonth}
                    </td>
 
                    <td>
                      {r.startMonth}
                      {" → "}
                      {r.endMonth || <span className="ll_muted">no end</span>}
                    </td>
                    <td>{r.isActive ? "Active" : "Inactive"}</td>
                    <td
                    style={{
                      width: 140,
                      minWidth: 140,
                      textAlign: "right",
                      verticalAlign: "top",
                      whiteSpace: "normal",
                    }}
                  >
                  <div className="ll_btnGroup">
                    <details>
                      <summary className="ll_btnSecondary">Edit</summary>
                  
                      <div className="ll_panel" style={{ marginTop: 6 }}>
                        <div className="ll_panelInner">
                          <form className="ll_form" action={updateRecurringTransaction}>
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="propertyId" value={props.propertyId} />
                            <input type="hidden" name="currentMonth" value={props.month} />
                  
                            <div className="ll_grid2">
                              <div>
                                <label className="ll_label" htmlFor={`category-${r.id}`}>
                                  Category
                                </label>
                                <select
                                  className="ll_input"
                                  id={`category-${r.id}`}
                                  name="categoryId"
                                  defaultValue={r.categoryId}
                                  required
                                  suppressHydrationWarning
                                >
                                  <option value="">Select…</option>
                                  {props.categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.type.toUpperCase()} • {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                  
                              <div>
                                <label className="ll_label" htmlFor={`amount-${r.id}`}>
                                  Amount
                                </label>
                                <input
                                  className="ll_input"
                                  id={`amount-${r.id}`}
                                  name="amount"
                                  type="number"
                                  step="0.01"
                                  defaultValue={(r.amountCents / 100).toFixed(2)}
                                  required
                                  suppressHydrationWarning
                                />
                              </div>
                  
                              <div>
                                <label className="ll_label" htmlFor={`memo-${r.id}`}>
                                  Memo
                                </label>
                                <input
                                  className="ll_input"
                                  id={`memo-${r.id}`}
                                  name="memo"
                                  type="text"
                                  defaultValue={r.memo ?? ""}
                                  suppressHydrationWarning
                                />
                              </div>
                  
                              <div>
                                <label className="ll_label" htmlFor={`day-${r.id}`}>
                                  Day of month
                                </label>
                                <input
                                  className="ll_input"
                                  id={`day-${r.id}`}
                                  name="dayOfMonth"
                                  type="number"
                                  min={1}
                                  max={28}
                                  defaultValue={r.dayOfMonth}
                                  required
                                  suppressHydrationWarning
                                />
                              </div>
                  
                              <div>
                                <label className="ll_label" htmlFor={`start-${r.id}`}>
                                  Start month
                                </label>
                                <input
                                  className="ll_input"
                                  id={`start-${r.id}`}
                                  name="startMonth"
                                  type="month"
                                  defaultValue={r.startMonth}
                                  required
                                  suppressHydrationWarning
                                />
                              </div>
                  
                              <div>
                                <label className="ll_label" htmlFor={`end-${r.id}`}>
                                  End month (optional)
                                </label>
                                <input
                                  className="ll_input"
                                  id={`end-${r.id}`}
                                  name="endMonth"
                                  type="month"
                                  defaultValue={r.endMonth ?? ""}
                                  suppressHydrationWarning
                                />
                              </div>
                            </div>
                  
                            <label className="ll_checkbox">
                              <input type="checkbox" name="isActive" defaultChecked={r.isActive} /> Active
                            </label>
                  
                            <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                              <button className="ll_btn" type="submit" suppressHydrationWarning>
                                Save
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    </details>
                  
                    <form action={toggleRecurringTransaction}>
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="propertyId" value={props.propertyId} />
                      <input type="hidden" name="month" value={props.month} />
                      <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                      <button
                        className="ll_btnSecondary"
                        type="submit"
                        suppressHydrationWarning
                        data-lpignore="true"
                      >
                        {r.isActive ? "Disable" : "Enable"}
                      </button>
                    </form>
                  
                    <form action={deleteRecurringTransaction} suppressHydrationWarning data-lpignore="true">
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="propertyId" value={props.propertyId} />
                      <input type="hidden" name="month" value={props.month} />
                      <button
                        className="ll_btnDanger"
                        type="submit"
                        suppressHydrationWarning
                        data-lpignore="true"
                        data-1p-ignore="true"
                      >
                        Delete
                      </button>
                    </form>
                  </div>

                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="ll_panel" style={{ marginTop: 12 }}>
          <div className="ll_panelInner">
            <h3 style={{ marginTop: 0 }}>Add recurring</h3>
            <form className="ll_form" action={createRecurringTransaction} suppressHydrationWarning data-lpignore="true" data-1p-ignore="true">
              <input type="hidden" name="propertyId" value={props.propertyId} />
              <input type="hidden" name="currentMonth" value={props.month} />

              <div className="ll_grid2">
                <div>
                  <label className="ll_label" htmlFor="rec-categoryId">
                    Category
                  </label>
                  <select
                    className="ll_input"
                    id="rec-categoryId"
                    name="categoryId"
                    required
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore="true"
                  >
                    <option value="">Select…</option>
                    {props.categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.type.toUpperCase()} • {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="ll_label" htmlFor="rec-amount">
                    Amount
                  </label>
                  <input
                    className="ll_input"
                    id="rec-amount"
                    name="amount"
                    type="number"
                    step="0.01"
                    required
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                  <div className="ll_muted" style={{ marginTop: 6 }}>
                    Enter a positive number. (Direction is based on category.)
                  </div>
                </div>

                <div>
                  <label className="ll_label" htmlFor="rec-memo">
                    Memo
                  </label>
                  <input
                    className="ll_input"
                    id="rec-memo"
                    name="memo"
                    type="text"
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </div>

                <div>
                  <label className="ll_label" htmlFor="rec-day">
                    Day of month
                  </label>
                  <input
                    className="ll_input"
                    id="rec-day"
                    name="dayOfMonth"
                    type="number"
                    min={1}
                    max={28}
                    defaultValue={1}
                    required
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore="true"
                  />
                </div>

                <div>
                  <label className="ll_label" htmlFor="rec-start">
                    Start month
                  </label>
                  <input className="ll_input" id="rec-start" name="startMonth" type="month" defaultValue={props.month} required />
                </div>

                <div>
                  <label className="ll_label" htmlFor="rec-end">
                    End month (optional)
                  </label>
                  <input className="ll_input" id="rec-end" name="endMonth" type="month" />
                </div>
              </div>

              <label className="ll_checkbox">
                <input type="checkbox" name="isActive" defaultChecked /> Active
              </label>

              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="ll_btn" type="submit" suppressHydrationWarning data-lpignore="true" data-1p-ignore="true">
                  Add recurring
                </button>
              </div>
            </form>
          </div>
        </div>
      </>
  ) : (
    <>
      {!props.recurringTablesReady && props.recurringErrorMsg ? (
        <div className="ll_muted" style={{ marginBottom: 8, whiteSpace: "pre-wrap" }}>
          {props.recurringErrorMsg}
        </div>
      ) : null}
  
      <div className="ll_muted" style={{ marginTop: 12 }}>
        Apply the latest Prisma migrations to manage recurring items.
      </div>
    </>
  )}
  </div>
  
  
  );
}

