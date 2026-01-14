import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getProfitLossByMonth } from "@/lib/reports/profitLossByMonth";

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

  const result = await getProfitLossByMonth({
    propertyId,
    startDate: formatInputDateUTC(startDate),
    endDate: formatInputDateUTC(endDate),
    includeTransfers,
    includeAnnualTotals,
  });

  const property =
    propertyId && propertyId !== ""
      ? await prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        })
      : null;
  const propertyName = property ? propertyLabel(property) : "";

  const rowsSheet: ExcelSheet = {
    name: "Profit Loss by Month",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "month", header: "Month", type: "text", width: 12 },
      { key: "incomeTotal", header: "Income Total", type: "currency", width: 16 },
      { key: "expenseTotal", header: "Expense Total", type: "currency", width: 16 },
      { key: "netTotal", header: "Net Total", type: "currency", width: 16 },
    ],
    rows: result.months.map((row) => ({
      propertyId: propertyId ?? "",
      propertyName,
      month: row.month,
      incomeTotal: row.incomeTotal,
      expenseTotal: row.expenseTotal,
      netTotal: row.netTotal,
    })),
  };

  const totalsSheet: ExcelSheet = {
    name: "Totals",
    columns: [
      { key: "incomeTotal", header: "Income Total", type: "currency", width: 16 },
      { key: "expenseTotal", header: "Expense Total", type: "currency", width: 16 },
      { key: "netTotal", header: "Net Total", type: "currency", width: 16 },
    ],
    rows: [
      {
        incomeTotal: result.totals.incomeTotal,
        expenseTotal: result.totals.expenseTotal,
        netTotal: result.totals.netTotal,
      },
    ],
  };

  const buffer = buildWorkbookBuffer([rowsSheet, totalsSheet]);
  const filename = `profit-loss-by-month-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
