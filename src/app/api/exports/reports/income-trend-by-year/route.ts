import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import { getIncomeTrendByYear } from "@/lib/reports/incomeTrendByYear";

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
  const categoryId = url.searchParams.get("categoryId") ?? "";
  const propertyId = url.searchParams.get("propertyId") ?? undefined;

  if (!categoryId) {
    return new Response("categoryId is required", { status: 400 });
  }

  const [category, report] = await Promise.all([
    prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    }),
    getIncomeTrendByYear({
      categoryId,
      propertyId: propertyId || undefined,
    }),
  ]);

  const properties = report.properties;

  const columns = [
    { key: "year", header: "Year", type: "number", width: 10 },
    ...properties.map((property) => ({
      key: property.id,
      header: property.label,
      type: "currency",
      width: 16,
    })),
  ];

  const rows = report.series.map((row) => {
    const record: Record<string, number> = { year: row.year };
    properties.forEach((property) => {
      record[property.id] = Number(row[property.id] ?? 0);
    });
    return record;
  });

  const rowsSheet: ExcelSheet = {
    name: "Income Trend",
    columns,
    rows,
  };

  const sheets = [rowsSheet];
  const buffer = buildWorkbookBuffer(sheets);

  const categoryLabel = category?.name ? slugify(category.name) : "category";
  const propertyLabel = propertyId
    ? slugify(properties[0]?.label ?? "property")
    : "all-properties";
  const yearRange =
    report.years.length > 0
      ? `${Math.min(...report.years)}-${Math.max(...report.years)}`
      : "no-years";
  const filename = `income-trend-by-year_${categoryLabel}_${propertyLabel}_${yearRange}_${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
