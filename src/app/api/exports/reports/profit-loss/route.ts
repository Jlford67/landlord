import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getProfitLossByProperty } from "@/lib/reports/profitLossByProperty";

export const runtime = "nodejs";

function parseDateUTC(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyId = url.searchParams.get("propertyId") || null;
  const includeTransfers = url.searchParams.get("includeTransfers") === "true";
  const includeAnnualTotals = url.searchParams.get("includeAnnualTotals") !== "false";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));

  const parsedStart = parseDateUTC(url.searchParams.get("startDate"));
  const parsedEnd = parseDateUTC(url.searchParams.get("endDate"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const result = await getProfitLossByProperty({
    propertyId,
    startDate,
    endDate,
    includeTransfers,
    includeAnnualTotals,
  });

  const rowsSheet: ExcelSheet = {
    name: "Profit Loss",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "categoryId", header: "Category ID", type: "id", width: 20 },
      { key: "parentCategory", header: "Parent Category", type: "text", width: 22 },
      { key: "categoryName", header: "Category Name", type: "text", width: 22 },
      { key: "categoryType", header: "Category Type", type: "text", width: 14 },
      { key: "transactionCount", header: "Transaction Count", type: "number", width: 16 },
      { key: "amount", header: "Amount", type: "currency", width: 14 },
    ],
    rows: result.rows.map((row) => ({
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      categoryId: row.categoryId,
      parentCategory: row.parentCategoryName ?? "",
      categoryName: row.categoryName,
      categoryType: row.type,
      transactionCount: row.count,
      amount: row.amount,
    })),
  };

  const totalsSheet: ExcelSheet = {
    name: "Totals",
    columns: [
      { key: "level", header: "Level", type: "text", width: 16 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "incomeTotal", header: "Income Total", type: "currency", width: 16 },
      { key: "expenseTotal", header: "Expense Total", type: "currency", width: 16 },
      { key: "netTotal", header: "Net Total", type: "currency", width: 16 },
    ],
    rows: [
      ...Object.values(result.subtotalsByProperty).map((row) => ({
        level: "Property",
        propertyId: row.propertyId,
        propertyName: row.propertyName,
        incomeTotal: row.incomeTotal,
        expenseTotal: row.expenseTotal,
        netTotal: row.netTotal,
      })),
      {
        level: "Grand Total",
        propertyId: "",
        propertyName: "",
        incomeTotal: result.totals.incomeTotal,
        expenseTotal: result.totals.expenseTotal,
        netTotal: result.totals.netTotal,
      },
    ],
  };

  const buffer = buildWorkbookBuffer([rowsSheet, totalsSheet]);
  const filename = `profit-loss-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
