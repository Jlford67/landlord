import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import React from "react";
import { dueDateForMonth, getScheduledRecurringForMonth } from "@/lib/recurring";
import { createRecurringSchema, updateRecurringSchema } from "@/lib/validation/recurring";

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
  const abs = Math.abs(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return n < 0 ? `(${abs})` : `$${abs}`;
}

function moneySpan(n: number) {
  const isNegative = n < 0;
  const isPositive = n > 0;

  return (
    <span
      style={{
        whiteSpace: "nowrap",
        fontWeight: 700,
        color: isNegative
          ? "var(--danger, #ff6b6b)"
          : isPositive
            ? "var(--success, #5dd3a6)"
            : "inherit",
      }}
    >
      {fmtMoney(n)}
    </span>
  );
}

function fmtDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function signedAmount(amountCents: number, categoryType: string) {
  const base = amountCents / 100;
  if (categoryType === "income") return Math.abs(base);
  if (categoryType === "expense") return -Math.abs(base);
  return base;
}

function redirectToLedger(propertyId: string, month: string, msg?: string, extra?: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  qs.set("month", month);
  if (msg) qs.set("msg", msg);
  if (extra) {
    for (const [key, value] of Object.entries(extra)) {
      if (value) qs.set(key, value);
    }
  }
  redirect(`/properties/${propertyId}/ledger?${qs.toString()}`);
}

type RecurringForm = {
  propertyId: string;
  categoryId: string;
  amount: string | number;
  memo?: string | null;
  dayOfMonth: string | number;
  startMonth: string;
  endMonth?: string | null;
  isActive?: string;
  currentMonth?: string;
};

async function createRecurringTransaction(formData: FormData) {
  "use server";
  await requireUser();

  const raw: RecurringForm = {
    propertyId: String(formData.get("propertyId") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    amount: formData.get("amount") || "0",
    memo: (formData.get("memo") as string | null) ?? undefined,
    dayOfMonth: formData.get("dayOfMonth") || "1",
    startMonth: String(formData.get("startMonth") || ""),
    endMonth: (formData.get("endMonth") as string | null) ?? undefined,
    isActive: (formData.get("isActive") as string | null) ?? undefined,
    currentMonth: (formData.get("currentMonth") as string | null) ?? undefined,
  };

  // Debug proof: server console should show this line whenever the handler runs.
  console.log("[recurring] createRecurringTransaction invoked", {
    propertyId: raw.propertyId,
    categoryId: raw.categoryId,
    amount: raw.amount,
    startMonth: raw.startMonth,
    currentMonth: raw.currentMonth,
  });

  const parsed = createRecurringSchema.safeParse(raw);
  if (!parsed.success) {
    const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
    console.warn("[recurring] validation failed", { propertyId: raw.propertyId, issues: parsed.error.issues });
    const detail = parsed.error.issues.map((i) => i.message).join("; ");
    return redirectToLedger(raw.propertyId, viewMonth, "recurring-error", { reason: "validation", detail });
  }

  const data = parsed.data;

  try {
    const created = await prisma.recurringTransaction.create({
      data: {
        propertyId: data.propertyId,
        categoryId: data.categoryId,
        amountCents: data.amount,
        memo: data.memo,
        dayOfMonth: data.dayOfMonth,
        startMonth: data.startMonth,
        endMonth: data.endMonth || undefined,
        isActive: data.isActive,
      },
    });
    console.log("[recurring] created", { id: created.id, propertyId: data.propertyId, month: data.startMonth });
  } catch (error) {
    console.error("[recurring] failed to create recurring transaction", {
      propertyId: data.propertyId,
      categoryId: data.categoryId,
      amountCents: data.amount,
      startMonth: data.startMonth,
      endMonth: data.endMonth,
      dayOfMonth: data.dayOfMonth,
      isActive: data.isActive,
      error,
    });

    const viewMonth = raw.currentMonth || data.startMonth;
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(data.propertyId, viewMonth, "recurring-missing-table");
    }

    return redirectToLedger(data.propertyId, viewMonth, "recurring-error", { reason: "exception", detail: "Unexpected error while saving." });
  }

  const viewMonth = raw.currentMonth || data.startMonth;
  redirectToLedger(data.propertyId, viewMonth, "recurring-created");
}

async function updateRecurringTransaction(formData: FormData) {
  "use server";
  await requireUser();

  const raw: RecurringForm & { id: string } = {
    id: String(formData.get("id") || ""),
    propertyId: String(formData.get("propertyId") || ""),
    categoryId: String(formData.get("categoryId") || ""),
    amount: formData.get("amount") || "0",
    memo: (formData.get("memo") as string | null) ?? undefined,
    dayOfMonth: formData.get("dayOfMonth") || "1",
    startMonth: String(formData.get("startMonth") || ""),
    endMonth: (formData.get("endMonth") as string | null) ?? undefined,
    isActive: (formData.get("isActive") as string | null) ?? undefined,
    currentMonth: (formData.get("currentMonth") as string | null) ?? undefined,
  };

  const parsed = updateRecurringSchema.safeParse(raw);
  if (!parsed.success) {
    const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
    const detail = parsed.error.issues.map((i) => i.message).join("; ");
    return redirectToLedger(raw.propertyId, viewMonth, "recurring-error", { reason: "validation", detail });
  }

  const data = parsed.data;

  await prisma.recurringTransaction.update({
    where: { id: data.id, propertyId: data.propertyId },
    data: {
      categoryId: data.categoryId,
      amountCents: data.amount,
      memo: data.memo,
      dayOfMonth: data.dayOfMonth,
      startMonth: data.startMonth,
      endMonth: data.endMonth || undefined,
      isActive: data.isActive,
    },
  });

  const viewMonth = raw.currentMonth || data.startMonth;
  redirectToLedger(data.propertyId, viewMonth, "recurring_updated");
}

async function toggleRecurringTransaction(formData: FormData) {
  "use server";
  await requireUser();

  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));
  const isActive = String(formData.get("isActive") || "") === "true";

  await prisma.recurringTransaction.update({
    where: { id, propertyId },
    data: { isActive },
  });

  redirectToLedger(propertyId, month, "recurring_toggled");
}

async function deleteRecurringTransaction(formData: FormData) {
  "use server";
  await requireUser();

  const id = String(formData.get("id") || "");
  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));

  await prisma.recurringTransaction.delete({
    where: { id, propertyId },
  });

  redirectToLedger(propertyId, month, "recurring_deleted");
}

async function postRecurringForMonth(formData: FormData) {
  "use server";
  await requireUser();

  const propertyId = String(formData.get("propertyId") || "");
  const month = String(formData.get("month") || ym(new Date()));

  let scheduled: Awaited<ReturnType<typeof getScheduledRecurringForMonth>> = [];
  try {
    scheduled = await getScheduledRecurringForMonth(propertyId, month);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(propertyId, month, "recurring-missing-table");
    }
    console.error("[recurring] failed to load scheduled recurring", { propertyId, month, error });
    return redirectToLedger(propertyId, month, "recurring-error", { reason: "exception", detail: "Failed to load scheduled items." });
  }

  const toPost = scheduled.filter((r) => !r.alreadyPosted && r.category);

  if (toPost.length === 0) {
    const detail =
      scheduled.length === 0
        ? "No active recurring items in range for this month."
        : "Everything for this month is already posted.";
    return redirectToLedger(propertyId, month, "recurring-none", { detail });
  }

  let postedCount = 0;
  try {
    await prisma.$transaction(async (tx) => {
      for (const rec of toPost) {
        const existing = await tx.recurringPosting.findFirst({
          where: { recurringTransactionId: rec.id, month },
          select: { id: true },
        });
        if (existing) continue;

        const txn = await tx.transaction.create({
          data: {
            propertyId,
            date: dueDateForMonth(month, rec.dayOfMonth),
            categoryId: rec.categoryId,
            amount: signedAmount(rec.amountCents, rec.category.type),
            memo: rec.memo ? `Recurring: ${rec.memo}` : `Recurring: ${rec.category.name}`,
            source: "manual",
          },
        });

        await tx.recurringPosting.create({
          data: {
            recurringTransactionId: rec.id,
            month,
            ledgerTransactionId: txn.id,
          },
        });
        postedCount += 1;
      }
    });
  } catch (error) {
    console.error("[recurring] failed to post recurring", { propertyId, month, error });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(propertyId, month, "recurring-missing-table");
    }
    return redirectToLedger(propertyId, month, "recurring-error", { reason: "exception", detail: "Failed to post recurring items." });
  }

  if (postedCount === 0) {
    return redirectToLedger(propertyId, month, "recurring-none", { detail: "Nothing new to post for this month." });
  }

  redirectToLedger(propertyId, month, "recurring-posted", { posted: String(postedCount) });
}

export default async function PropertyLedgerPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const { id } = params;
  const sp = searchParams;

  const monthParam = typeof sp.month === "string" ? sp.month : undefined;
  const month = monthParam && /^\d{4}-\d{2}$/.test(monthParam) ? monthParam : ym(new Date());

  const msg = typeof sp.msg === "string" ? sp.msg : undefined;
  const msgReason = typeof sp.reason === "string" ? sp.reason : undefined;
  const msgDetail = typeof sp.detail === "string" ? sp.detail : undefined;
  const msgPosted = typeof sp.posted === "string" ? sp.posted : undefined;
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
      <div className="ll_page" suppressHydrationWarning>
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

  let recurringItems: Awaited<ReturnType<typeof prisma.recurringTransaction.findMany>> = [];
  let recurringTablesReady = true;
  try {
    recurringItems = await prisma.recurringTransaction.findMany({
      where: { propertyId: id },
      include: {
        category: true,
        postings: true,
      },
      orderBy: [
        { isActive: "desc" },
        { dayOfMonth: "asc" },
        { createdAt: "asc" },
      ],
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      recurringTablesReady = false;
    } else {
      throw error;
    }
  }

  const scheduledRecurring = recurringTablesReady ? await getScheduledRecurringForMonth(id, month) : [];

  const recurringPostings = recurringTablesReady
    ? await prisma.recurringPosting.findMany({
        where: { month, recurringTransaction: { propertyId: id } },
        select: { ledgerTransactionId: true, recurringTransactionId: true },
      })
    : [];
  const recurringByTxn = new Set(recurringPostings.map((p) => p.ledgerTransactionId));

  const scheduledTotal = recurringTablesReady
    ? scheduledRecurring.reduce((acc, r) => acc + signedAmount(r.amountCents, r.category.type), 0)
    : 0;
  const postedTotal = recurringTablesReady
    ? scheduledRecurring
        .filter((r) => r.alreadyPosted)
        .reduce((acc, r) => acc + signedAmount(r.amountCents, r.category.type), 0)
    : 0;

  const monthOptions: string[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    monthOptions.push(ym(d));
  }

  return (
    <div className="ll_page" suppressHydrationWarning>
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
          {msg === "postedRecurring" ? <div className="ll_notice">Recurring posted for this month.</div> : null}
          {msg === "recurring_created" || msg === "recurring-created" ? <div className="ll_notice">Recurring item added.</div> : null}
          {msg === "recurring_updated" ? <div className="ll_notice">Recurring item updated.</div> : null}
          {msg === "recurring_deleted" ? <div className="ll_notice">Recurring item deleted.</div> : null}
          {msg === "recurring_toggled" ? <div className="ll_notice">Recurring status updated.</div> : null}
          {msg === "recurring-posted" ? (
            <div className="ll_notice">Posted {msgPosted || "recurring"} item{msgPosted === "1" ? "" : "s"} for {monthLabel(month)}.</div>
          ) : null}
          {msg === "recurring-none" ? (
            <div className="ll_notice">
              No recurring items were posted for {monthLabel(month)}.{msgDetail ? ` ${msgDetail}` : ""}
            </div>
          ) : null}
          {msg === "recurring_error" || msg === "recurring-error" ? (
            <div className="ll_notice" style={{ background: "rgba(255, 107, 107, 0.1)", color: "#ff6b6b" }}>
              Could not save recurring item.{msgReason === "validation" ? " Check all required fields and month order." : " Please try again."}
              {msgDetail ? ` (${msgDetail})` : ""}
            </div>
          ) : null}
          {msg === "recurring_missing_table" || msg === "recurring-missing-table" ? (
            <div className="ll_notice" style={{ background: "rgba(255, 107, 107, 0.1)", color: "#ff6b6b" }}>
              Recurring tables are missing in your database. Run <code>npx prisma migrate dev</code> to apply{" "}
              <code>recurring_transactions</code>.
            </div>
          ) : null}
          {!recurringTablesReady ? (
            <div className="ll_notice" style={{ background: "rgba(255, 107, 107, 0.1)", color: "#ff6b6b" }}>
              Recurring tables are missing in your database. Run <code>npx prisma migrate dev</code> to apply{' '}
              <code>recurring_transactions</code>.
            </div>
          ) : null}

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
                <form
                  method="get"
                  action={`/properties/${property.id}/ledger`}
                  style={{ display: "flex", gap: 8 }}
                  suppressHydrationWarning
                >
                  <select name="month" className="ll_input" defaultValue={month} suppressHydrationWarning>
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
                Income: <span className="ll_code">{fmtMoney(income)}</span> • Expense: {" "}
                <span className="ll_code">{fmtMoney(expense)}</span> • Net: {" "}
                <span className="ll_code">{fmtMoney(net)}</span>
              </div>
              <div>
                Recurring scheduled: <span className="ll_code">{fmtMoney(scheduledTotal)}</span> • Posted: {" "}
                <span className="ll_code">{fmtMoney(postedTotal)}</span>
              </div>
            </div>
          </div>

          <div className="ll_panel" style={{ marginTop: 12 }}>
            <div className="ll_panelInner">
              <h2 style={{ marginTop: 0 }}>Recurring</h2>
              <div className="ll_muted" style={{ marginBottom: 10 }}>
                Set up monthly items like HOA. Post them into the ledger when ready.
              </div>
              {categories.length === 0 ? (
                <div className="ll_notice" style={{ background: "rgba(255, 193, 7, 0.12)", color: "#8a6d3b" }}>
                  No categories available. Create categories first so you can assign recurring items.
                </div>
              ) : null}
              {recurringTablesReady ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table className="ll_table" style={{ width: "100%", tableLayout: "fixed" }}>
                      <thead>
                        <tr>
                          <th style={{ width: "20%" }}>Name</th>
                          <th style={{ width: "16%" }}>Category</th>
                          <th style={{ width: "12%" }}>Amount</th>
                          <th style={{ width: "10%" }}>Day</th>
                          <th style={{ width: "18%" }}>Range</th>
                          <th style={{ width: "10%" }}>Status</th>
                          <th style={{ width: "14%" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recurringItems.length === 0 ? (
                          <tr>
                            <td colSpan={7}>
                              <div className="ll_muted">No recurring items yet.</div>
                            </td>
                          </tr>
                        ) : (
                          recurringItems.map((r) => (
                            <tr key={r.id}>
                              <td style={{ whiteSpace: "normal" }}>
                                {r.memo || r.category?.name || <span className="ll_muted">(none)</span>}
                              </td>
                              <td>{r.category?.name || <span className="ll_muted">(missing)</span>}</td>
                              <td>{fmtMoney(r.amountCents / 100)}</td>
                              <td>{r.dayOfMonth}</td>
                              <td>
                                {r.startMonth}
                                {" → "}
                                {r.endMonth || <span className="ll_muted">no end</span>}
                              </td>
                              <td>{r.isActive ? "Active" : "Inactive"}</td>
                              <td>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <details style={{ width: "100%" }}>
                                    <summary className="ll_btnSecondary" style={{ display: "inline-block" }}>
                                      Edit
                                    </summary>
                                    <div className="ll_panel" style={{ marginTop: 6 }}>
                                      <div className="ll_panelInner">
                                        <form className="ll_form" action={updateRecurringTransaction}>
                                          <input type="hidden" name="id" value={r.id} />
                                          <input type="hidden" name="propertyId" value={property.id} />
                                          <input type="hidden" name="currentMonth" value={month} />
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
                                                {categories.map((c) => (
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
                                            <button className="ll_btn" type="submit">
                                              Save
                                            </button>
                                          </div>
                                        </form>
                                      </div>
                                    </div>
                                  </details>
                                  <form action={toggleRecurringTransaction} style={{ display: "inline" }}>
                                    <input type="hidden" name="id" value={r.id} />
                                    <input type="hidden" name="propertyId" value={property.id} />
                                    <input type="hidden" name="month" value={month} />
                                    <input type="hidden" name="isActive" value={r.isActive ? "false" : "true"} />
                                    <button className="ll_btnSecondary" type="submit">
                                      {r.isActive ? "Disable" : "Enable"}
                                    </button>
                                  </form>
                                  <form action={deleteRecurringTransaction} style={{ display: "inline" }}>
                                    <input type="hidden" name="id" value={r.id} />
                                    <input type="hidden" name="propertyId" value={property.id} />
                                    <input type="hidden" name="month" value={month} />
                                    <button className="ll_btnSecondary" type="submit">
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
                      <form className="ll_form" action={createRecurringTransaction} suppressHydrationWarning>
                        <input type="hidden" name="propertyId" value={property.id} />
                        <input type="hidden" name="currentMonth" value={month} />
                        <div className="ll_grid2">
                          <div>
                            <label className="ll_label" htmlFor="rec-categoryId">
                              Category
                            </label>
                            <select className="ll_input" id="rec-categoryId" name="categoryId" required suppressHydrationWarning>
                              <option value="">Select…</option>
                              {categories.map((c) => (
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
                            <input className="ll_input" id="rec-amount" name="amount" type="number" step="0.01" required suppressHydrationWarning />
                            <div className="ll_muted" style={{ marginTop: 6 }}>
                              Enter a positive number. (Direction is based on category.)
                            </div>
                          </div>

                          <div>
                            <label className="ll_label" htmlFor="rec-memo">
                              Memo
                            </label>
                            <input className="ll_input" id="rec-memo" name="memo" type="text" suppressHydrationWarning />
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
                              defaultValue={month}
                              required
                              suppressHydrationWarning
                            />
                          </div>

                          <div>
                            <label className="ll_label" htmlFor="rec-end">
                              End month (optional)
                            </label>
                            <input className="ll_input" id="rec-end" name="endMonth" type="month" suppressHydrationWarning />
                          </div>
                        </div>

                        <label className="ll_checkbox">
                          <input type="checkbox" name="isActive" defaultChecked /> Active
                        </label>

                        <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                          <button className="ll_btn" type="submit" suppressHydrationWarning>
                            Add recurring
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                </>
              ) : (
                <div className="ll_muted" style={{ marginTop: 12 }}>
                  Apply the latest Prisma migrations to manage recurring items.
                </div>
              )}
            </div>
          </div>

          <div className="ll_panel" style={{ marginTop: 12 }}>
            <div className="ll_panelInner">
              <div className="ll_rowBetween" style={{ alignItems: "center" }}>
                <h2 style={{ marginTop: 0 }}>Month actions</h2>
                <div className="ll_muted">{monthLabel(month)}</div>
              </div>
              <form action={postRecurringForMonth} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="hidden" name="propertyId" value={property.id} />
                <input type="hidden" name="month" value={month} />
                <button
                  className="ll_btn"
                  type="submit"
                  suppressHydrationWarning
                >
                  Post recurring for {monthLabel(month)}
                </button>
                <div className="ll_muted" style={{ marginLeft: 8 }}>
                  {scheduledRecurring.length === 0
                    ? "No recurring scheduled for this month."
                    : `${scheduledRecurring.filter((r) => !r.alreadyPosted).length} pending / ${scheduledRecurring.length} total`}
                </div>
              </form>

              {scheduledRecurring.length > 0 ? (
                <div style={{ marginTop: 10 }}>
                  <div className="ll_muted" style={{ marginBottom: 6 }}>
                    Scheduled (not yet posted)
                  </div>
                  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {scheduledRecurring.map((r) => (
                      <div key={r.id} className="ll_chip" style={{ opacity: r.alreadyPosted ? 0.6 : 1 }}>
                        <b>{r.category.name}</b> • {fmtMoney(signedAmount(r.amountCents, r.category.type))} on day {r.dayOfMonth}
                        {r.alreadyPosted ? " (posted)" : ""}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="ll_panel" style={{ marginTop: 12 }}>
            <div className="ll_panelInner">
              <h2 style={{ marginTop: 0 }}>Add transaction</h2>
              <form className="ll_form" action={`/api/properties/${property.id}/transactions`} method="post" suppressHydrationWarning>
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
                    <select className="ll_input" id="categoryId" name="categoryId" required suppressHydrationWarning>
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
                          <input className="ll_input" id="amount" name="amount" type="number" step="0.01" required suppressHydrationWarning />
                    <div className="ll_muted" style={{ marginTop: 6 }}>
                      Enter a positive number. (We will handle expense/income direction based on category.)
                    </div>
                  </div>

                  <div>
                    <label className="ll_label" htmlFor="memo">
                      Memo
                    </label>
                    <input className="ll_input" id="memo" name="memo" type="text" suppressHydrationWarning />
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
                        const isRecurring = recurringByTxn.has(t.id);

                        return (
                          <tr key={t.id} style={isDeletedRow ? { opacity: 0.65 } : undefined}>
                            <td style={{ whiteSpace: "nowrap" }}>{fmtDate(t.date)}</td>

                            <td style={{ whiteSpace: "normal" }}>
                              <span className="ll_muted">{t.category.type.toUpperCase()}</span>{" - "}
                              {t.category.name}
                            </td>

                            <td style={{ whiteSpace: "normal" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                {t.memo || <span className="ll_muted">(none)</span>}
                                {isRecurring ? <span className="ll_chip">Recurring</span> : null}
                              </div>
                            </td>

                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{moneySpan(t.amount)}</td>

                            <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{moneySpan(balance)}</td>

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
