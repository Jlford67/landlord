import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getAnnualProfitAndLossSummary } from "@/lib/reports/annualProfitAndLossSummary";

export const runtime = "nodejs";

function parseYear(value?: string | null): number | null {
  if (!value) return null;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  return num;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const startYearParsed = parseYear(url.searchParams.get("startYear"));
  const endYearParsed = parseYear(url.searchParams.get("endYear"));

  let startYear = startYearParsed ?? endYearParsed ?? currentYear;
  let endYear = endYearParsed ?? startYearParsed ?? currentYear;

  if (startYear > endYear) {
    [startYear, endYear] = [endYear, startYear];
  }

  const [result, property] = await Promise.all([
    getAnnualProfitAndLossSummary({
      propertyId,
      startYear,
      endYear,
      includeTransfers,
    }),
    propertyId
      ? prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
        })
      : Promise.resolve(null),
  ]);

  const propertyName = property ? propertyLabel(property) : "";

  const totalsSheet: ExcelSheet = {
    name: "Annual Totals",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "year", header: "Year", type: "number", width: 10 },
      { key: "incomeTotal", header: "Income Total", type: "currency", width: 16 },
      { key: "expenseTotal", header: "Expense Total", type: "currency", width: 16 },
      { key: "transferTotal", header: "Transfer Total", type: "currency", width: 16 },
      { key: "netTotal", header: "Net Total", type: "currency", width: 16 },
    ],
    rows: result.years.map((year) => ({
      propertyId: propertyId ?? "",
      propertyName,
      year: year.year,
      incomeTotal: year.incomeTotal,
      expenseTotal: year.expenseTotal,
      transferTotal: year.transferTotal,
      netTotal: year.netTotal,
    })),
  };

  const categoriesSheet: ExcelSheet = {
    name: "Category Breakdown",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "year", header: "Year", type: "number", width: 10 },
      { key: "categoryId", header: "Category ID", type: "id", width: 20 },
      { key: "categoryName", header: "Category Name", type: "text", width: 22 },
      { key: "categoryType", header: "Category Type", type: "text", width: 14 },
      { key: "depth", header: "Depth", type: "number", width: 10 },
      { key: "amount", header: "Amount", type: "currency", width: 16 },
    ],
    rows: result.years.flatMap((year) =>
      year.categories.map((category) => ({
        propertyId: propertyId ?? "",
        propertyName,
        year: year.year,
        categoryId: category.categoryId,
        categoryName: category.name,
        categoryType: category.type,
        depth: category.depth,
        amount: category.amount,
      }))
    ),
  };

  const buffer = buildWorkbookBuffer([totalsSheet, categoriesSheet]);
  const filename = `annual-profit-loss-summary-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}