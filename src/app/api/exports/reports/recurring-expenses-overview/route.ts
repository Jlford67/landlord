import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getRecurringExpensesOverviewReport } from "@/lib/reports/recurringExpensesOverview";

export const runtime = "nodejs";

function parseDateUTC(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function formatInputDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function centsToDollars(value: number) {
  return value / 100;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw === "all" ? "" : propertyIdRaw;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";
  const includeInactiveRaw = (url.searchParams.get("includeInactive") ?? "").toLowerCase();
  const includeInactive = includeInactiveRaw === "1" || includeInactiveRaw === "true";
  const groupRaw = url.searchParams.get("group");
  const group = groupRaw === "category" ? "category" : "property";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const parsedStart = parseDateUTC(url.searchParams.get("start"));
  const parsedEnd = parseDateUTC(url.searchParams.get("end"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;
  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const report = await getRecurringExpensesOverviewReport({
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId: propertyId || undefined,
    includeTransfers,
    includeInactive,
  });

  const rows = [...report.rows];
  rows.sort((a, b) => {
    if (group === "category") {
      if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
      if (a.propertyLabel !== b.propertyLabel) return a.propertyLabel.localeCompare(b.propertyLabel);
      const memoA = a.memo ?? "";
      const memoB = b.memo ?? "";
      return memoA.localeCompare(memoB);
    }
    if (a.propertyLabel !== b.propertyLabel) return a.propertyLabel.localeCompare(b.propertyLabel);
    if (a.categoryName !== b.categoryName) return a.categoryName.localeCompare(b.categoryName);
    const memoA = a.memo ?? "";
    const memoB = b.memo ?? "";
    return memoA.localeCompare(memoB);
  });

  const recurringSheet: ExcelSheet = {
    name: "Recurring Expenses",
    columns: [
      { key: "recurringId", header: "Recurring ID", type: "id", width: 20 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 30 },
      { key: "categoryId", header: "Category ID", type: "id", width: 20 },
      { key: "categoryName", header: "Category Name", type: "text", width: 22 },
      { key: "memo", header: "Memo", type: "notes", width: 40 },
      { key: "monthlyAmount", header: "Monthly Amount", type: "currency", width: 16 },
      { key: "monthsCount", header: "Months in Range", type: "number", width: 16 },
      { key: "monthsInRange", header: "Months in Range List", type: "text", width: 30 },
      { key: "expectedTotal", header: "Expected Total", type: "currency", width: 16 },
      { key: "postedTotal", header: "Posted Total", type: "currency", width: 16 },
      { key: "variance", header: "Variance", type: "currency", width: 16 },
      { key: "missingMonths", header: "Missing Months", type: "text", width: 30 },
    ],
    rows: rows.map((row) => ({
      recurringId: row.recurringTransactionId,
      propertyId: row.propertyId,
      propertyName: row.propertyLabel,
      categoryId: row.categoryId,
      categoryName: row.categoryName,
      memo: row.memo ?? "",
      monthlyAmount: centsToDollars(row.monthlyAmountCents),
      monthsCount: row.monthsInRange.length,
      monthsInRange: row.monthsInRange.join(", "),
      expectedTotal: centsToDollars(row.expectedTotalCents),
      postedTotal: centsToDollars(row.postedTotalCents),
      variance: centsToDollars(row.varianceCents),
      missingMonths: row.missingMonths.join(", "),
    })),
  };

  const totalsSheet: ExcelSheet = {
    name: "Other Totals",
    columns: [
      { key: "otherTransactional", header: "Other Transactional Expenses", type: "currency", width: 24 },
      { key: "annualExpense", header: "Annual Expenses", type: "currency", width: 18 },
      { key: "allExpenses", header: "All Expenses", type: "currency", width: 16 },
    ],
    rows: [
      {
        otherTransactional: centsToDollars(report.otherTotals.otherTransactionalExpenseCents),
        annualExpense: centsToDollars(report.otherTotals.annualExpenseCents),
        allExpenses: centsToDollars(report.otherTotals.allExpenseCents),
      },
    ],
  };

  const buffer = buildWorkbookBuffer([recurringSheet, totalsSheet]);
  const filename = `recurring-expenses-overview-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
