import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";
import {
  endExclusive,
  getRentalIncomeByPropertyReport,
  isRentalIncomeCategory,
  prorateAnnualForRange,
} from "@/lib/reports/rentalIncomeByProperty";

export const runtime = "nodejs";

type DrillBucket = "total" | "annual" | "transactional";

function parseDateUTC(value?: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, (mm ?? 1) - 1, dd ?? 1));
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

function parseDrillBucket(value: string): DrillBucket {
  if (value === "annual" || value === "transactional" || value === "total") {
    return value;
  }
  return "total";
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);

  const propertyIdRaw = url.searchParams.get("propertyId");
  const propertyId = propertyIdRaw && propertyIdRaw !== "all" ? propertyIdRaw : null;
  const includeTransfersRaw = (url.searchParams.get("includeTransfers") ?? "").toLowerCase();
  const includeTransfers = includeTransfersRaw === "1" || includeTransfersRaw === "true";
  const includeOtherIncomeRaw = (url.searchParams.get("includeOtherIncome") ?? "").toLowerCase();
  const includeOtherIncome = includeOtherIncomeRaw === "1" || includeOtherIncomeRaw === "true";

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

  const result = await getRentalIncomeByPropertyReport({
    start: formatInputDateUTC(startDate),
    end: formatInputDateUTC(endDate),
    propertyId,
    includeTransfers,
    includeOtherIncome,
  });

  const rowsSheet: ExcelSheet = {
    name: "Rental Income",
    columns: [
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "transactionalIncome", header: "Transactional Income", type: "currency", width: 18 },
      { key: "annualIncome", header: "Annual Income", type: "currency", width: 16 },
      { key: "totalIncome", header: "Total Income", type: "currency", width: 16 },
    ],
    rows: result.rows.map((row) => ({
      propertyId: row.propertyId,
      propertyName: row.propertyLabel,
      transactionalIncome: row.transactionalIncomeCents,
      annualIncome: row.annualIncomeCents,
      totalIncome: row.totalIncomeCents,
    })),
  };

  const drillPropertyId = url.searchParams.get("drillPropertyId") || null;
  const drillBucket = parseDrillBucket(url.searchParams.get("drillBucket") ?? "");
  const drillTarget = drillPropertyId
    ? result.rows.find((row) => row.propertyId === drillPropertyId) ?? null
    : null;

  let drilldownSheet: ExcelSheet | null = null;

  if (drillTarget) {
    const allowedCategoryTypes = includeTransfers ? ["income", "transfer"] : ["income"];
    const endDateExclusive = endExclusive(endDate);

    const ledgerTxns = await prisma.transaction.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endDateExclusive,
        },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        date: true,
        amount: true,
        payee: true,
        memo: true,
        category: { select: { name: true, type: true } },
      },
      orderBy: [{ date: "asc" }, { id: "asc" }],
    });

    const ledgerRows = ledgerTxns
      .map((txn) => {
        const category = txn.category;
        if (!category) return null;

        const isIncomeLike =
          category.type === "income" || (includeTransfers && category.type === "transfer");
        if (!isIncomeLike) return null;

        const isRentalCategory =
          category.type === "income" && isRentalIncomeCategory(category.name);
        if (!includeOtherIncome && !isRentalCategory) return null;

        const rawAmount = Number(txn.amount ?? 0);
        const normalizedAmount = rawAmount < 0 ? Math.abs(rawAmount) : rawAmount;
        if (drillBucket === "annual") return null;
        return {
          sourceId: txn.id,
          type: "ledger",
          period: formatMonthYearUTC(txn.date),
          date: txn.date,
          category: category.name,
          description: txn.payee || txn.memo || "-",
          amount: normalizedAmount,
        };
      })
      .filter((row): row is NonNullable<typeof row> => Boolean(row));

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();

    const annualRows = await prisma.annualCategoryAmount.findMany({
      where: {
        propertyId: drillTarget.propertyId,
        year: { gte: startYear, lte: endYear },
        category: { type: { in: allowedCategoryTypes } },
      },
      select: {
        id: true,
        year: true,
        amount: true,
        note: true,
        category: { select: { name: true, type: true } },
      },
      orderBy: [{ year: "asc" }, { id: "asc" }],
    });

    const annualDetailRows = annualRows
      .map((row) => {
        const category = row.category;
        if (!category) return null;

        const isIncomeLike =
          category.type === "income" || (includeTransfers && category.type === "transfer");
        if (!isIncomeLike) return null;

        const isRentalCategory =
          category.type === "income" && isRentalIncomeCategory(category.name);
        if (!includeOtherIncome && !isRentalCategory) return null;

        const baseAmount = Number(row.amount ?? 0);
        const normalizedAmount = baseAmount < 0 ? Math.abs(baseAmount) : baseAmount;
        const prorated = prorateAnnualForRange(row.year, normalizedAmount, startDate, endDate);
        if (prorated === 0) return null;
        if (drillBucket === "transactional") return null;
        return {
          sourceId: row.id,
          type: "annual",
          period: `${row.year} (Annual)`,
          date: null,
          category: category.name,
          description: row.note?.trim() || "Annual amount (prorated)",
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
  const filename = `rental-income-by-property-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
