import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getCashVsAccrualPLReport } from "@/lib/reports/cashVsAccrualPL";

export const runtime = "nodejs";

function parseDateUTC(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function formatInputDateUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";
  const viewRaw = url.searchParams.get("view");
  const view = viewRaw === "byCategory" ? "byCategory" : "summary";

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

  const [report, property] = await Promise.all([
    getCashVsAccrualPLReport({
      start: formatInputDateUTC(startDate),
      end: formatInputDateUTC(endDate),
      propertyId,
      includeTransfers,
      view,
    }),
    propertyId
      ? prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        })
      : Promise.resolve(null),
  ]);

  const propertyName = property ? propertyLabel(property) : "";

  const summarySheet: ExcelSheet = {
    name: "Summary",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "basis", header: "Basis", type: "text", width: 12 },
      { key: "income", header: "Income", type: "currency", width: 16 },
      { key: "expense", header: "Expense", type: "currency", width: 16 },
      { key: "net", header: "Net", type: "currency", width: 16 },
      { key: "transactionalIncome", header: "Transactional Income", type: "currency", width: 18 },
      { key: "transactionalExpense", header: "Transactional Expense", type: "currency", width: 18 },
      { key: "annualIncome", header: "Annual Income", type: "currency", width: 16 },
      { key: "annualExpense", header: "Annual Expense", type: "currency", width: 16 },
    ],
    rows: [
      {
        propertyId: propertyId ?? "",
        propertyName,
        basis: "Cash",
        income: report.cash.totals.incomeCents,
        expense: report.cash.totals.expenseCents,
        net: report.cash.totals.netCents,
        transactionalIncome: report.cash.breakdown.transactionalIncomeCents,
        transactionalExpense: report.cash.breakdown.transactionalExpenseCents,
        annualIncome: report.cash.breakdown.annualIncomeCents,
        annualExpense: report.cash.breakdown.annualExpenseCents,
      },
      {
        propertyId: propertyId ?? "",
        propertyName,
        basis: "Accrual",
        income: report.accrual.totals.incomeCents,
        expense: report.accrual.totals.expenseCents,
        net: report.accrual.totals.netCents,
        transactionalIncome: report.accrual.breakdown.transactionalIncomeCents,
        transactionalExpense: report.accrual.breakdown.transactionalExpenseCents,
        annualIncome: report.accrual.breakdown.annualIncomeCents,
        annualExpense: report.accrual.breakdown.annualExpenseCents,
      },
      {
        propertyId: propertyId ?? "",
        propertyName,
        basis: "Delta",
        income: report.delta.incomeCents,
        expense: report.delta.expenseCents,
        net: report.delta.netCents,
        transactionalIncome: null,
        transactionalExpense: null,
        annualIncome: null,
        annualExpense: null,
      },
    ],
  };

  const categorySheet: ExcelSheet = {
    name: "Categories",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "basis", header: "Basis", type: "text", width: 12 },
      { key: "categoryId", header: "Category ID", type: "id", width: 20 },
      { key: "categoryName", header: "Category Name", type: "text", width: 24 },
      { key: "income", header: "Income", type: "currency", width: 16 },
      { key: "expense", header: "Expense", type: "currency", width: 16 },
      { key: "net", header: "Net", type: "currency", width: 16 },
    ],
    rows: [
      ...(report.cash.byCategory ?? []).map((row) => ({
        propertyId: propertyId ?? "",
        propertyName,
        basis: "Cash",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        income: row.incomeCents,
        expense: row.expenseCents,
        net: row.netCents,
      })),
      ...(report.accrual.byCategory ?? []).map((row) => ({
        propertyId: propertyId ?? "",
        propertyName,
        basis: "Accrual",
        categoryId: row.categoryId,
        categoryName: row.categoryName,
        income: row.incomeCents,
        expense: row.expenseCents,
        net: row.netCents,
      })),
    ],
  };

  const sheets = view === "byCategory" ? [summarySheet, categorySheet] : [summarySheet];
  const buffer = buildWorkbookBuffer(sheets);
  const filename = `cash-vs-accrual-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
