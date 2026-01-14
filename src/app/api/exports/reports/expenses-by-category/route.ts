import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { propertyLabel } from "@/lib/format";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import {
  addDaysUTC,
  calculateProratedAnnualAmount,
  getExpensesByCategoryReport,
} from "@/lib/reports/expensesByCategory";

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
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";

  const now = new Date();
  const defaultStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const defaultEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const parsedStart = parseDateUTC(url.searchParams.get("start"));
  const parsedEnd = parseDateUTC(url.searchParams.get("end"));

  let startDate = parsedStart ?? defaultStart;
  let endDate = parsedEnd ?? defaultEnd;

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const report = await getExpensesByCategoryReport({
    propertyId,
    startDate,
    endDate,
    includeTransfers,
  });

  const rowsSheet: ExcelSheet = {
    name: "Expenses by Category",
    columns: [
      { key: "categoryId", header: "Category ID", type: "id", width: 20 },
      { key: "categoryName", header: "Category Name", type: "text", width: 24 },
      { key: "depth", header: "Depth", type: "number", width: 10 },
      { key: "amount", header: "Amount", type: "currency", width: 16 },
    ],
    rows: report.rows.map((row) => ({
      categoryId: row.id,
      categoryName: row.name,
      depth: row.depth,
      amount: row.amount,
    })),
  };

  const drillCategoryId = url.searchParams.get("drillCategoryId") || null;
  const drillTarget = drillCategoryId
    ? report.rows.find((row) => row.id === drillCategoryId) ?? null
    : null;

  let drilldownSheet: ExcelSheet | null = null;

  if (drillTarget) {
    const allowedTypes = includeTransfers ? ["expense", "transfer"] : ["expense"];
    const categories = await prisma.category.findMany({
      where: { type: { in: allowedTypes } },
      select: {
        id: true,
        name: true,
        parentId: true,
      },
    });

    const childrenMap = new Map<string | null, string[]>();
    categories.forEach((category) => {
      const key = category.parentId ?? null;
      const siblings = childrenMap.get(key) ?? [];
      siblings.push(category.id);
      childrenMap.set(key, siblings);
    });

    const drillCategoryIds = new Set<string>();
    const stack = [drillTarget.id];
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || drillCategoryIds.has(current)) continue;
      drillCategoryIds.add(current);
      const children = childrenMap.get(current) ?? [];
      children.forEach((child) => stack.push(child));
    }

    const categoryIds = Array.from(drillCategoryIds);
    const endExclusive = addDaysUTC(endDate, 1);

    const transactionSelect = {
      id: true,
      date: true,
      amount: true,
      payee: true,
      memo: true,
      category: { select: { name: true } },
      ...(propertyId
        ? {}
        : {
            property: {
              select: {
                id: true,
                nickname: true,
                street: true,
                city: true,
                state: true,
                zip: true,
              },
            },
          }),
    } as const;

    const ledgerTxns = await prisma.transaction.findMany({
      where: {
        propertyId: propertyId || undefined,
        categoryId: { in: categoryIds },
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endExclusive,
        },
        category: { type: { in: allowedTypes } },
      },
      select: transactionSelect,
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const ledgerRows = ledgerTxns.map((txn) => {
      const rowPropertyLabel =
        propertyId || !("property" in txn) || !txn.property
          ? undefined
          : propertyLabel(txn.property);
      return {
        sourceId: txn.id,
        type: "ledger",
        period: formatMonthYearUTC(txn.date),
        date: txn.date,
        category: txn.category.name,
        description: txn.payee || txn.memo || "-",
        propertyName: rowPropertyLabel,
        amount: txn.amount,
      };
    });

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    const annualSelect = {
      id: true,
      year: true,
      amount: true,
      note: true,
      category: { select: { name: true } },
      ...(propertyId
        ? {}
        : {
            property: {
              select: {
                id: true,
                nickname: true,
                street: true,
                city: true,
                state: true,
                zip: true,
              },
            },
          }),
    } as const;

    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: propertyId || undefined,
        categoryId: { in: categoryIds },
        year: { gte: startYear, lte: endYear },
      },
      select: annualSelect,
      orderBy: [{ year: "asc" }, { id: "asc" }],
    });

    const annualDetailRows = annualRows
      .map((row) => {
        const prorated = calculateProratedAnnualAmount({
          amount: Number(row.amount ?? 0),
          year: row.year,
          startDate,
          endDate,
        });
        if (prorated === 0) return null;
        const rowPropertyLabel =
          propertyId || !("property" in row) || !row.property
            ? undefined
            : propertyLabel(row.property);
        return {
          sourceId: row.id,
          type: "annual",
          period: `${row.year} (Annual)`,
          date: null,
          category: row.category.name,
          description: row.note?.trim() || "Annual amount (prorated)",
          propertyName: rowPropertyLabel,
          amount: prorated,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const drilldownRows = [...annualDetailRows, ...ledgerRows].sort((a, b) => {
      if (a.period !== b.period) return a.period.localeCompare(b.period);
      if (a.type !== b.type) return a.type.localeCompare(b.type);
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
        { key: "propertyName", header: "Property", type: "text", width: 28 },
        { key: "amount", header: "Amount", type: "currency", width: 16 },
      ],
      rows: drilldownRows.map((row) => ({
        sourceId: row.sourceId,
        type: row.type,
        period: row.period,
        date: row.date ?? null,
        category: row.category,
        description: row.description,
        propertyName: row.propertyName ?? "",
        amount: row.amount,
      })),
    };
  }

  const sheets = drilldownSheet ? [rowsSheet, drilldownSheet] : [rowsSheet];
  const buffer = buildWorkbookBuffer(sheets);
  const filename = `expenses-by-category-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
