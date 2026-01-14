import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getScheduleESummaryReport } from "@/lib/reports/scheduleESummary";

export const runtime = "nodejs";

type Mode = "combined" | "transactionalOnly" | "annualOnly";

function parseYear(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
}

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

function rangeFromYear(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

function centsToDollars(value: number) {
  return value / 100;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;

  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const modeRaw = url.searchParams.get("mode");
  const mode: Mode =
    modeRaw === "transactionalOnly" || modeRaw === "annualOnly" ? modeRaw : "combined";

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const yearParam = parseYear(url.searchParams.get("year"));
  const startParam = parseDateUTC(url.searchParams.get("start"));
  const endParam = parseDateUTC(url.searchParams.get("end"));

  const baseRange = rangeFromYear(yearParam ?? currentYear);

  let startDate = yearParam ? baseRange.start : startParam ?? baseRange.start;
  let endDate = yearParam ? baseRange.end : endParam ?? baseRange.end;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const [report, property] = await Promise.all([
    getScheduleESummaryReport({
      year: yearParam ?? undefined,
      start: formatInputDateUTC(startDate),
      end: formatInputDateUTC(endDate),
      propertyId: propertyId ?? undefined,
      includeTransfers,
      mode,
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
      { key: "startDate", header: "Start Date", type: "date", width: 12 },
      { key: "endDate", header: "End Date", type: "date", width: 12 },
      { key: "mode", header: "Mode", type: "text", width: 16 },
      { key: "incomeTotal", header: "Income Total", type: "currency", width: 16 },
      { key: "expenseTotal", header: "Expense Total", type: "currency", width: 16 },
      { key: "netTotal", header: "Net Total", type: "currency", width: 16 },
    ],
    rows: [
      {
        propertyId: propertyId ?? "",
        propertyName,
        startDate,
        endDate,
        mode: report.input.mode,
        incomeTotal: centsToDollars(report.income.totalIncomeCents),
        expenseTotal: centsToDollars(report.expenses.totalExpenseCents),
        netTotal: centsToDollars(report.netCents),
      },
    ],
  };

  const incomeSheet: ExcelSheet = {
    name: "Income",
    columns: [
      { key: "incomeType", header: "Income Type", type: "text", width: 24 },
      { key: "amount", header: "Amount", type: "currency", width: 16 },
    ],
    rows: [
      { incomeType: "Rents received", amount: centsToDollars(report.income.rentsReceivedCents) },
      { incomeType: "Other income", amount: centsToDollars(report.income.otherIncomeCents) },
      { incomeType: "Total income", amount: centsToDollars(report.income.totalIncomeCents) },
    ],
  };

  const expensesSheet: ExcelSheet = {
    name: "Expenses",
    columns: [
      { key: "bucketKey", header: "Bucket Key", type: "text", width: 20 },
      { key: "bucketLabel", header: "Bucket Label", type: "text", width: 26 },
      { key: "transactional", header: "Transactional", type: "currency", width: 16 },
      { key: "annual", header: "Annual", type: "currency", width: 16 },
      { key: "combined", header: "Combined", type: "currency", width: 16 },
    ],
    rows: report.expenses.buckets.map((bucket) => ({
      bucketKey: bucket.key,
      bucketLabel: bucket.label,
      transactional: centsToDollars(bucket.transactionalCents),
      annual: centsToDollars(bucket.annualCents),
      combined: centsToDollars(bucket.combinedCents),
    })),
  };

  const sheets = [summarySheet, incomeSheet, expensesSheet];

  if (report.byProperty) {
    sheets.push({
      name: "By Property",
      columns: [
        { key: "propertyId", header: "Property ID", type: "id", width: 20 },
        { key: "propertyName", header: "Property Name", type: "text", width: 32 },
        { key: "income", header: "Income", type: "currency", width: 16 },
        { key: "expenses", header: "Expenses", type: "currency", width: 16 },
        { key: "net", header: "Net", type: "currency", width: 16 },
      ],
      rows: report.byProperty.rows.map((row) => ({
        propertyId: row.propertyId,
        propertyName: row.propertyLabel,
        income: centsToDollars(row.incomeCents),
        expenses: centsToDollars(row.expenseCents),
        net: centsToDollars(row.netCents),
      })),
    });
  }

  const buffer = buildWorkbookBuffer(sheets);
  const filename = `schedule-e-summary-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
