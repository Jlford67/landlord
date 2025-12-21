import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import React from "react";

function ym(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  const mm = Number(m);
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[mm - 1]} ${y}`;
}

function parseMonth(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { y, m0: m - 1 };
}

function fmtMoney(n: number) {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toFixed(2)}`;
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export default async function PropertyLedgerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : ym(new Date());

  const msg = typeof sp.msg === "string" ? sp.msg : undefined;
  const undoId = typeof sp.undoId === "string" ? sp.undoId : undefined;

  const { y, m0 } = parseMonth(month);
  const start = new Date(y, m0, 1);
  const end = new Date(y, m0 + 1, 1);

  const property = await prisma.property.findFirst({
    where: { id },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  if (!property) {
    return (
      <div className="ll_page">
        <div className="ll_panel">
          <div className="ll_panelInner">
            <h1>Ledger</h1>
            <div className="ll_notice">Property not found.</div>
          </div>
        </div>
      </div>
    );
  }

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
    select: { id: true, name: true, type: true, parentId: true },
  });

  const startingAgg = await prisma.transaction.aggregate({
    where: { propertyId: id, deletedAt: null, date: { lt: start } },
    _sum: { amount: true },
  });
  const startingBalance = startingAgg._sum.amount ?? 0;

  const txns = await prisma.transaction.findMany({
    where: { propertyId: id, deletedAt: null, date: { gte: start, lt: end } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    include: { category: true },
  });

  const undoTxn =
    msg === "deleted" && undoId
      ? await prisma.transaction.findFirst({
          where: { id: undoId, propertyId: id },
          include: { category: true },
        })
      : null;

  const cmpTxn = (a: { date: Date; id: string }, b: { date: Date; id: string }) => {
    const ad = a.date.getTime();
    const bd = b.date.getTime();
    if (ad !== bd) return bd - ad;
    return b.id.localeCompare(a.id);
  };

  let displayTxns: any[] = [...txns];

  if (undoTxn && undoTxn.deletedAt) {
    const inRange = undoTxn.date >= start && undoTxn.date < end;
    if (inRange) {
      const already = displayTxns.some((t) => t.id === undoTxn.id);
      if (!already) displayTxns = [...displayTxns, undoTxn].sort(cmpTxn);
    }
  }

  let income = 0;
  let expense = 0;
  for (const t of txns) {
    if (t.amount >= 0) income += t.amount;
    else expense += Math.abs(t.amount);
  }
  const net = income - expense;

  let running = startingBalance;
  const runningById = new Map<string, number>();
  for (const t of txns) {
    running += t.amount;
    runningById.set(t.id, running);
  }

  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(ym(d));
  }

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_rowBetween">
          <div>
            <h1>Ledger</h1>
            <div className="ll_muted">
              {property.nickname ? <b>{property.nickname}</b> : <b>(no nickname)</b>}
              {" • "}
              {property.street}
              {property.city ? `, ${property.city}` : ""}
              {property.state ? `, ${property.state}` : ""}
              {property.zip ? ` ${property.zip}` : ""}
            </div>
          </div>

          <div className="ll_topbarRight">
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Property
            </Link>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}/leases`}>
              Leases
            </Link>
          </div>
        </div>

        <div className="ll_panelInner">
          {msg === "deleted" ? <div className="ll_notice">Transaction deleted.</div> : null}

          <div className="ll_rowBetween" style={{ alignItems: "flex-end", gap: 12, marginTop: 10 }}>
            <div>
              <div className="ll_muted">Month</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <a className="ll_btnSecondary" href={`/properties/${property.id}/ledger?month=${ym(new Date())}`}>
                  This month
                </a>
                <a
                  className="ll_btnSecondary"
                  href={`/properties/${property.id}/ledger?month=${ym(
                    new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
                  )}`}
                >
                  Last month
                </a>
                <form method="get" action={`/properties/${property.id}/ledger`} style={{ display: "flex", gap: 8 }}>
                  <select name="month" className="ll_input" defaultValue={month}>
                    {monthOptions.map((m) => (
                      <option key={m} value={m}>
                        {monthLabel(m)}
                      </option>
                    ))}
                  </select>
                  <button className="ll_btnSecondary" type="submit">
                    Go
                  </button>
                </form>
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
              <div className="ll_muted">Summary</div>
              <div>
                Starting balance: <span className="ll_code">{fmtMoney(startingBalance)}</span>
              </div>
              <div>
                Income: <span className="ll_code">{fmtMoney(income)}</span> • Expense:{" "}
                <span className="ll_code">{fmtMoney(expense)}</span> • Net:{" "}
                <span className="ll_code">{fmtMoney(net)}</span>
              </div>
            </div>
          </div>

          <div className="ll_panel" style={{ marginTop: 12 }}>
            <div className="ll_panelInner">
              <h2 style={{ marginTop: 0 }}>Add transaction</h2>
              <form className="ll_form" action={`/api/properties/${property.id}/transactions`} method="post">
                <input type="hidden" name="returnTo" value={`/properties/${property.id}/ledger?month=${month}`} />
                <div className="ll_grid2">
                  <div>
                    <label className="ll_label" htmlFor="date">
                      Date
                    </label>
                    <input
                      className="ll_input"
                      id="date"
                      name="date"
                      type="date"
                      defaultValue={fmtDate(new Date())}
                      required
                      suppressHydrationWarning
                    />
                  </div>

                  <div>
                    <label className="ll_label" htmlFor="categoryId">
                      Category
                    </label>
                    <select className="ll_input" id="categoryId" name="categoryId" required>
                      <option value="">Select…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.type.toUpperCase()} • {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="ll_label" htmlFor="amount">
                      Amount
                    </label>
                    <input className="ll_input" id="amount" name="amount" type="number" step="0.01" required />
                    <div className="ll_muted" style={{ marginTop: 6 }}>
                      Enter a positive number. (We will handle expense/income direction based on category.)
                    </div>
                  </div>

                  <div>
                    <label className="ll_label" htmlFor="memo">
                      Memo
                    </label>
                    <input className="ll_input" id="memo" name="memo" type="text" />
                  </div>
                </div>

                <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                  <button className="ll_btn" type="submit" suppressHydrationWarning>
                    Add
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="ll_panel" style={{ marginTop: 12 }}>
            <div className="ll_panelInner">
              <div className="ll_rowBetween">
                <h2 style={{ marginTop: 0 }}>Transactions</h2>
                <div className="ll_muted">{monthLabel(month)}</div>
              </div>

              {txns.length === 0 ? (
                <div className="ll_muted">No transactions for this month.</div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="ll_table" style={{ width: "100%", tableLayout: "fixed" }}>
                    <thead>
                    <tr>
                      <th style={{ width: 120 }}>Date</th>
                      <th style={{ width: "36%" }}>Category</th>
                      <th style={{ width: "34%" }}>Memo</th>
                      <th style={{ textAlign: "right", width: 130 }}>Amount</th>
                      <th style={{ textAlign: "right", width: 130 }}>Balance</th>
                      <th style={{ textAlign: "right", width: 190 }}>Actions</th>
                    </tr>


                    </thead>
                    <tbody>
                      {displayTxns.map((t: any) => {
                        const isDeletedRow = Boolean(t.deletedAt);
                        const showUndo = msg === "deleted" && undoId === t.id && isDeletedRow;

                        const balance = runningById.get(t.id) ?? 0;

                        return (
                          <tr key={t.id} style={isDeletedRow ? { opacity: 0.65 } : undefined}>
                            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>
                          
                            <td style={{ whiteSpace: "normal" }}>
                              <span className="ll_muted">{t.category.type.toUpperCase()}</span>{" - "}
                              {t.category.name}
                            </td>
                          
                            <td style={{ whiteSpace: "normal" }}>
                              {t.memo || <span className="ll_muted">(none)</span>}
                            </td>
                          
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(t.amount)}</td>
                          
                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{fmtMoney(balance)}</td>
                          
                            <td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                                {!isDeletedRow ? (
                                  <>
                                    <Link
                                      className="ll_btnSecondary"
                                      href={`/properties/${property.id}/ledger/${t.id}/edit?returnTo=${encodeURIComponent(
                                        `/properties/${property.id}/ledger?month=${month}`
                                      )}`}
                                    >
                                      Edit
                                    </Link>
                          
                                    <form
                                      action={`/api/properties/${property.id}/transactions/${t.id}/delete`}
                                      method="post"
                                      style={{ display: "inline" }}
                                    >
                                      <input type="hidden" name="returnTo" value={`/properties/${property.id}/ledger?month=${month}`} />
                                      <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                                        Delete
                                      </button>
                                    </form>
                                  </>
                                ) : showUndo ? (
                                  <form
                                    action={`/api/properties/${property.id}/transactions/${t.id}/undelete`}
                                    method="post"
                                    style={{ display: "inline" }}
                                  >
                                    <input type="hidden" name="returnTo" value={`/properties/${property.id}/ledger?month=${month}`} />
                                    <button className="ll_btnSecondary" type="submit" suppressHydrationWarning>
                                      Undo
                                    </button>
                                  </form>
                                ) : (
                                  <span className="ll_muted">Deleted</span>
                                )}
                              </div>
                            </td>
                          </tr>

                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <Link className="ll_btnSecondary" href={`/properties/${property.id}`}>
              Back to property
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
