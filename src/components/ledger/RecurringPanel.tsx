"use client";

import React, { useTransition } from "react";
import { fmtMoney } from "@/lib/format";
import { useRouter } from "next/navigation";
import {
  createRecurringTransaction,
  updateRecurringTransaction,
  toggleRecurringTransaction,
  deleteRecurringTransaction,
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

function friendlyRecurringError(detail?: string, reason?: string) {
  const d = (detail ?? "").trim();
  const r = (reason ?? "").trim();
  if (d && r) return `${d} (${r})`;
  return d || r || "Unknown error";
}

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

  return (
    <div suppressHydrationWarning>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 mb-1.5 text-base font-semibold">Recurring</h2>
          <div className="ll_muted mb-2.5">
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

      <div className="ll_notice bg-gray-100 text-gray-800">
        Loaded categories: {props.categories.length}
        {props.categories.length === 0 ? (
          <span>
            {" "}
            • No categories found. Go to <a href="/categories">/categories</a> and add an EXPENSE
            category first.
          </span>
        ) : null}
      </div>

      {props.msg === "recurring_created" ? (
        <div className="ll_notice bg-green-50 text-green-700">Recurring item added.</div>
      ) : null}

      {props.msg === "recurring_error" ? (
        <div className="ll_notice bg-red-50 text-red-700">
          Could not add recurring item: {friendlyRecurringError(props.msgDetail, props.msgReason)}
        </div>
      ) : null}

      {props.categories.length === 0 ? (
        <div className="ll_notice bg-amber-50 text-amber-800">
          No categories available. Create categories first so you can assign recurring items.
        </div>
      ) : null}

      {props.recurringTablesReady ? (
        <>
          <div className="ll_table_wrap">
            <table className="ll_table ll_table_zebra w-full">
              <thead>
                <tr>
                  <th className="w-[24%]">Name</th>
                  <th className="w-[16%]">Category</th>
                  <th className="w-[10%] text-right">Amount</th>
                  <th className="w-[8%] text-center">Day</th>
                  <th className="w-[20%]">Range</th>
                  <th className="w-[10%]">Status</th>
                  <th className="w-[12%] text-right">Actions</th>
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
                      <td className="whitespace-normal">
                        {r.memo || r.category?.name || <span className="ll_muted">(none)</span>}
                      </td>

                      <td>{r.category?.name || <span className="ll_muted">(missing)</span>}</td>

                      <td className="text-right whitespace-nowrap tabular-nums">
                        {fmtMoney(r.amountCents / 100)}
                      </td>

                      <td className="text-center whitespace-nowrap">{r.dayOfMonth}</td>

                      <td>
                        {r.startMonth}
                        {" → "}
                        {r.endMonth || <span className="ll_muted">no end</span>}
                      </td>

                      <td>{r.isActive ? "Active" : "Inactive"}</td>

                      <td className="w-[140px] min-w-[140px] text-right align-top whitespace-normal">
                        <div className="ll_btnGroup">
                          <details>
                            <summary className="ll_btnSecondary">Edit</summary>

                            <div className="ll_panel mt-1.5">
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
                                    <input
                                      type="checkbox"
                                      name="isActive"
                                      defaultChecked={r.isActive}
                                    />{" "}
                                    Active
                                  </label>

                                  <div className="mt-2.5 flex gap-2">
                                    <button className="ll_btnPrimary" type="submit" suppressHydrationWarning>
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
                            <input
                              type="hidden"
                              name="isActive"
                              value={r.isActive ? "false" : "true"}
                            />
                            <button
                              className="ll_btnSecondary"
                              type="submit"
                              suppressHydrationWarning
                              data-lpignore="true"
                            >
                              {r.isActive ? "Disable" : "Enable"}
                            </button>
                          </form>

                          <form
                            action={deleteRecurringTransaction}
                            suppressHydrationWarning
                            data-lpignore="true"
                          >
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

          <div className="ll_panel mt-3">
            <div className="ll_panelInner">
              <h3 className="m-0 mb-2 text-base font-semibold">Add recurring</h3>
              <form
                className="ll_form"
                action={createRecurringTransaction}
                suppressHydrationWarning
                data-lpignore="true"
                data-1p-ignore="true"
              >
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
                    <div className="ll_muted mt-1.5">
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
                    <input
                      className="ll_input"
                      id="rec-start"
                      name="startMonth"
                      type="month"
                      defaultValue={props.month}
                      required
                    />
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

                <div className="mt-2.5 flex gap-2">
                  <button
                    className="ll_btnWarning"
                    type="submit"
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore="true"
                  >
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
            <div className="ll_muted mb-2 whitespace-pre-wrap">{props.recurringErrorMsg}</div>
          ) : null}

          <div className="ll_muted mt-3">Apply the latest Prisma migrations to manage recurring items.</div>
        </>
      )}
    </div>
  );
}
