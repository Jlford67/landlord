import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import {
  addDaysUTC,
  calculateProratedAnnualExpense,
  getExpensesByProperty,
} from "@/lib/reports/expensesByProperty";

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

function formatMonthYearUTC(d: Date) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${m}-${y}`;
}

export async function GET(req: Request) {
  const user = await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw || null;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

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

  const report = await getExpensesByProperty({
    userId: user.id,
    startDate,
    endDate,
    includeTransfers,
    propertyId,
  });

  const rowsSheet: ExcelSheet = {
    name: "Expenses by Property",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "transactionalExpense", header: "Transactional Expense", type: "currency", width: 18 },
      { key: "annualExpense", header: "Annual Expense", type: "currency", width: 16 },
      { key: "totalExpense", header: "Total Expense", type: "currency", width: 16 },
    ],
    rows: report.rows.map((row) => ({
      propertyId: row.propertyId,
      propertyName: row.propertyLabel,
      transactionalExpense: row.transactionalExpense,
      annualExpense: row.annualExpense,
      totalExpense: row.totalExpense,
    })),
  };

  const drillPropertyId = url.searchParams.get("drillPropertyId") || null;
  const drillTarget = drillPropertyId
    ? report.rows.find((row) => row.propertyId === drillPropertyId) ?? null
    : null;

  let drilldownSheet: ExcelSheet | null = null;

  if (drillTarget) {
    const endExclusive = addDaysUTC(endDate, 1);
    const allowedCategoryTypes = includeTransfers ? ["expense", "transfer"] : ["expense"];

    const ledgerTxns = await prisma.transaction.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        deletedAt: null,
        amount: { lt: 0 },
        date: {
          gte: startDate,
          lt: endExclusive,
        },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        payee: true,
        memo: true,
        category: { select: { name: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const ledgerRows = ledgerTxns.map((txn) => {
      const description = txn.payee || txn.memo || "-";
      return {
        sourceId: txn.id,
        type: "ledger",
        period: formatMonthYearUTC(txn.date),
        date: txn.date,
        category: txn.category.name,
        description,
        amount: txn.amount,
      };
    });

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        year: { gte: startYear, lte: endYear },
        category: { type: "expense" },
      },
      select: {
        id: true,
        year: true,
        amount: true,
        note: true,
        category: { select: { name: true } },
      },
    });

    const annualDetailRows = annualRows
      .map((row) => {
        const prorated = calculateProratedAnnualExpense({
          amount: Number(row.amount ?? 0),
          year: row.year,
          startDate,
          endDate,
        });
        if (prorated === 0) return null;
        return {
          sourceId: row.id,
          type: "annual",
          period: `${row.year} (Annual)`,
          date: null,
          category: row.category.name,
          description: row.note?.trim() || "Annual amount (prorated)",
          amount: prorated,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const drilldownRows = [...annualDetailRows, ...ledgerRows].sort((a, b) => {
      if (a.period !== b.period) return a.period.localeCompare(b.period);
      if (a.date && b.date) return a.date.getTime() - b.date.getTime();
      if (a.date) return 1;
      if (b.date) return -1;
      return a.description.localeCompare(b.description);
    });

    drilldownSheet = {
      name: "Drilldown",
      columns: [
        { key: "sourceId", header: "Source ID", type: "id", width: 20 },
        { key: "type", header: "Type", type: "text", width: 12 },
        { key: "period", header: "Period", type: "text", width: 14 },
        { key: "date", header: "Date", type: "date", width: 12 },
        { key: "category", header: "Category", type: "text", width: 22 },
        { key: "description", header: "Description", type: "notes", width: 50 },
        { key: "amount", header: "Amount", type: "currency", width: 16 },
      ],
      rows: drilldownRows.map((row) => ({
        sourceId: row.sourceId,
        type: row.type,
        period: row.period,
        date: row.date ?? null,
        category: row.category,
        description: row.description,
        amount: row.amount,
      })),
    };
  }

  const sheets = drilldownSheet ? [rowsSheet, drilldownSheet] : [rowsSheet];
  const buffer = buildWorkbookBuffer(sheets);
  const filename = `expenses-by-property-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
