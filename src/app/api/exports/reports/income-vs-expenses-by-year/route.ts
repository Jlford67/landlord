import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getIncomeVsExpensesByYear } from "@/lib/reports/incomeVsExpensesByYear";

export const runtime = "nodejs";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  const [property, report] = await Promise.all([
    propertyId
      ? prisma.property.findUnique({
          where: { id: propertyId },
          select: {
            id: true,
            nickname: true,
            street: true,
            city: true,
            state: true,
            zip: true,
          },
        })
      : Promise.resolve(null),
    getIncomeVsExpensesByYear({ propertyId: propertyId || undefined }),
  ]);

  const rows = report.rows.map((row) => ({
    year: row.year,
    income: row.income,
    expenses: Math.abs(row.expenses),
    net: row.net,
  }));

  const columns = [
    { key: "year", header: "Year", type: "number", width: 10 },
    { key: "income", header: "Income", type: "currency", width: 16 },
    { key: "expenses", header: "Expenses", type: "currency", width: 16 },
    { key: "net", header: "Net", type: "currency", width: 16 },
  ];

  const rowsSheet: ExcelSheet = {
    name: "Income vs Expenses",
    columns,
    rows,
  };

  const buffer = buildWorkbookBuffer([rowsSheet]);

  const propertySlug = property
    ? slugify(propertyLabel(property))
    : "all-properties";
  const filename = `income-vs-expenses-by-year_${propertySlug}_${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
