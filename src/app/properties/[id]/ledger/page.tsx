import TransactionRowActions from "@/components/ledger/TransactionRowActions";
import { fmtMoney } from "@/lib/format";
import RecurringPanel from "@/components/ledger/RecurringPanel";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import React from "react";
import { dueDateForMonth, getScheduledRecurringForMonth } from "@/lib/recurring";
import { createRecurringSchema, updateRecurringSchema } from "@/lib/validation/recurring";
import { MonthPicker } from "@/components/ledger/MonthPicker";

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

  try {
    // Normalize all inputs (blank strings -> undefined where appropriate)
    const propertyId = String(formData.get("propertyId") || "").trim();
    const categoryId = String(formData.get("categoryId") || "").trim();

    const amountRaw = formData.get("amount");
    const amount = String(amountRaw ?? "0").trim();

    const memoRaw = formData.get("memo");
    const memo =
      typeof memoRaw === "string" && memoRaw.trim() !== "" ? memoRaw.trim() : undefined;

    const dayOfMonthRaw = formData.get("dayOfMonth");
    const dayOfMonth = String(dayOfMonthRaw ?? "1").trim();

    const startMonth = String(formData.get("startMonth") || "").trim();

    const endMonthRaw = formData.get("endMonth");
    const endMonth =
      typeof endMonthRaw === "string" && endMonthRaw.trim() !== ""
        ? endMonthRaw.trim()
        : undefined;

    const isActiveRaw = formData.get("isActive");
    const isActive = typeof isActiveRaw === "string" ? isActiveRaw : undefined;

    const currentMonthRaw = formData.get("currentMonth");
    const currentMonth =
      typeof currentMonthRaw === "string" && currentMonthRaw.trim() !== ""
        ? currentMonthRaw.trim()
        : undefined;

    const raw: RecurringForm = {
      propertyId,
      categoryId,
      amount,
      memo,
      dayOfMonth,
      startMonth,
      endMonth,
      isActive,
      currentMonth,
    };

    console.log("[recurring] form", {
      propertyId: raw.propertyId,
      categoryId: raw.categoryId,
      amount: raw.amount,
      startMonth: raw.startMonth,
      endMonth: raw.endMonth,
      dayOfMonth: raw.dayOfMonth,
      isActive: raw.isActive,
    });

    if (!raw.categoryId) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      console.error("[recurring] create failed", { detail: "missing_category", propertyId: raw.propertyId });
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_category" });
    }

    if (raw.amount === "" || raw.amount === null) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      console.error("[recurring] create failed", { detail: "missing_amount", propertyId: raw.propertyId });
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_amount" });
    }

    if (!raw.startMonth) {
      const viewMonth = raw.currentMonth || ym(new Date());
      console.error("[recurring] create failed", { detail: "missing_startMonth", propertyId: raw.propertyId });
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail: "missing_startMonth" });
    }

    const parsed = createRecurringSchema.safeParse(raw);
    if (!parsed.success) {
      const viewMonth = raw.currentMonth || raw.startMonth || ym(new Date());
      const detail = parsed.error.issues.some((i) => i.path.includes("amount")) ? "invalid_amount" : "validation_error";
      console.error("[recurring] create failed", {
        detail,
        propertyId: raw.propertyId,
        issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
      });
      return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { detail });
    }

    const data = parsed.data;

    console.log("[recurring] create", {
      propertyId: data.propertyId,
      categoryId: data.categoryId,
      amount: data.amount,
      startMonth: data.startMonth,
      endMonth: data.endMonth,
      dayOfMonth: data.dayOfMonth,
      isActive: data.isActive,
    });

    const created = await prisma.recurringTransaction.create({
      data: {
        propertyId: data.propertyId,
        categoryId: data.categoryId,
        amountCents: data.amount,
        memo: data.memo,
        dayOfMonth: data.dayOfMonth,
        startMonth: data.startMonth,
        // IMPORTANT: undefined when blank, so Prisma stores NULL
        endMonth: data.endMonth ?? undefined,
        isActive: data.isActive,
      },
    });

    console.log("[recurring] created", { id: created.id, propertyId: data.propertyId, month: data.startMonth });

    const viewMonth = raw.currentMonth || data.startMonth;
    return redirectToLedger(data.propertyId, viewMonth, "recurring_created");
  } catch (error: any) {
    // redirect() throws NEXT_REDIRECT intentionally. Do not treat it as an error.
    if (error?.digest?.startsWith("NEXT_REDIRECT")) throw error;

    console.error("[recurring] create failed", { detail: "prisma_error", err: error });

    const propertyId = String(formData.get("propertyId") || "").trim();
    const currentMonth = String(formData.get("currentMonth") || formData.get("startMonth") || ym(new Date())).trim();

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2021") {
      return redirectToLedger(propertyId, currentMonth, "recurring_error", { detail: "missing_table" });
    }
    return redirectToLedger(propertyId, currentMonth || ym(new Date()), "recurring_error", { detail: "prisma_error" });
  }
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
    return redirectToLedger(raw.propertyId, viewMonth, "recurring_error", { reason: "validation", detail });
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
      return redirectToLedger(propertyId, month, "recurring_error", { detail: "missing_table" });
    }
    console.error("[recurring] failed to load scheduled recurring", { propertyId, month, error });
    return redirectToLedger(propertyId, month, "recurring_error", { detail: "prisma_error_load" });
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
      return redirectToLedger(propertyId, month, "recurring_error", { detail: "missing_table" });
    }
    return redirectToLedger(propertyId, month, "recurring_error", { detail: "prisma_error_post" });
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
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const sp = await searchParams;

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

  let recurringItems: {
    id: string;
    categoryId: string;
    amountCents: number;
    memo: string | null;
    dayOfMonth: number;
    startMonth: string;
    endMonth: string | null;
    isActive: boolean;
    category: { id: string; name: string; type: string } | null;
  }[] = [];
  
  let recurringTablesReady = true;
  
  try {
    recurringItems = await prisma.recurringTransaction.findMany({
      where: { propertyId: id },
      select: {
        id: true,
        categoryId: true,
        amountCents: true,
        memo: true,
        dayOfMonth: true,
        startMonth: true,
        endMonth: true,
        isActive: true,
        category: { select: { id: true, name: true, type: true } },
      },
      orderBy: [{ isActive: "desc" }, { dayOfMonth: "asc" }, { createdAt: "asc" }],
    });
  } catch (error: any) {
    if (error?.code === "P2021") {
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

  const friendlyRecurringError = (detail?: string, reason?: string) => {
    if (!detail && reason === "validation") return "Validation failed. Check required fields and month order.";
    switch (detail) {
      case "missing_category":
        return "Select a category for this recurring item.";
      case "missing_startMonth":
        return "Provide a start month for this recurring item.";
      case "missing_amount":
        return "Enter an amount.";
      case "invalid_amount":
        return "Enter a valid amount.";
      case "validation_error":
        return "Validation failed. Check required fields and month order.";
      case "prisma_error":
        return "Unexpected database error while saving. Please retry.";
      case "missing_table":
        return "Recurring tables are missing. Run `npx prisma migrate dev`.";
      case "prisma_error_load":
        return "Could not load scheduled recurring items.";
      case "prisma_error_post":
        return "Could not post recurring items.";
      default:
        if (detail) return detail;
        return "Please try again.";
    }
  };

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
          {msg === "postedRecurring" ? <div className="ll_notice">Recurring posted for this month.</div> : null}
          {msg === "recurring_created" ? <div className="ll_notice">Recurring item added.</div> : null}
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
          {msg === "recurring_error" && msgDetail === "missing_table" ? (
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
            <MonthPicker propertyId={property.id} month={month} monthOptions={monthOptions} />

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
                  data-lpignore="true"
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

          <RecurringPanel
            propertyId={property.id}
            month={month}
            categories={categories}
            recurringTablesReady={recurringTablesReady}
            recurringItems={recurringItems}
            scheduledRecurring={scheduledRecurring}
            msg={msg}
            msgDetail={msgDetail}
            msgReason={msgReason}
            msgPosted={msgPosted}
          />

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

                                    <Link
                                      className="ll_btnSecondary"
                                      href={`/properties/${property.id}/ledger/${t.id}/delete?returnTo=${encodeURIComponent(
                                        `/properties/${property.id}/ledger?month=${month}`
                                      )}`}
                                    >
                                      Delete
                                    </Link>

                                  </>
                                ) : showUndo ? (
                                  <Link
                                    className="ll_btnSecondary"
                                    href={`/properties/${property.id}/ledger/${t.id}/undelete?returnTo=${encodeURIComponent(
                                      `/properties/${property.id}/ledger?month=${month}`
                                    )}`}
                                  >
                                    Undo
                                  </Link>

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
