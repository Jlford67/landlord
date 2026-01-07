import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type Metric =
  | "netCashFlow"
  | "avgMonthlyCashFlow"
  | "yieldOnCostPct"
  | "appreciationDollar"
  | "appreciationPct"
  | "totalReturnDollar"
  | "totalReturnPct";

export type StatusFilter = "active" | "sold" | "watchlist" | "all";
export type ValuationSource = "zillow" | "redfin" | "auto";

type CurrentValueSource = "sold" | "zillow" | "redfin" | null;

export type Row = {
  propertyId: string;
  propertyLabel: string;
  status: string;
  purchasePriceCents: number | null;
  purchaseDate: string | null;
  currentValueCents: number | null;
  currentValueSource: CurrentValueSource;
  transactionalNetCents: number;
  annualNetCents: number;
  netCashFlowCents: number;
  avgMonthlyCashFlowCents: number;
  yieldOnCostPct: number | null;
  appreciationCents: number | null;
  appreciationPct: number | null;
  totalReturnCents: number | null;
  totalReturnPct: number | null;
  rankValue: number | null;
};

export type Report = {
  input: {
    metric: Metric;
    year?: number;
    start: string;
    end: string;
    status: StatusFilter;
    includeTransfers: boolean;
    valuation: ValuationSource;
  };
  rows: Row[];
  totals: {
    transactionalNetCents: number;
    annualNetCents: number;
    netCashFlowCents: number;
  };
  notes: {
    usesCurrentAppreciation: boolean;
  };
};

type ReportInput = {
  metric?: Metric;
  year?: number;
  start: string;
  end: string;
  status?: StatusFilter;
  includeTransfers?: boolean;
  valuation?: ValuationSource;
};

const MS_PER_DAY = 86_400_000;

function parseYmd(s: string): Date {
  const [yy, mm, dd] = s.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function formatYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function endExclusive(endInclusive: Date): Date {
  return new Date(
    Date.UTC(
      endInclusive.getUTCFullYear(),
      endInclusive.getUTCMonth(),
      endInclusive.getUTCDate() + 1
    )
  );
}

function rangeFromYear(year: number) {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

function monthCountInclusive(start: Date, end: Date): number {
  const monthStart = start.getUTCFullYear() * 12 + start.getUTCMonth();
  const monthEnd = end.getUTCFullYear() * 12 + end.getUTCMonth();
  return Math.max(1, monthEnd - monthStart + 1);
}

function daysInYear(year: number): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / MS_PER_DAY);
}

function overlapDaysInclusive(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function prorateAnnualForRange(
  year: number,
  amountCents: number,
  rangeStart: Date,
  rangeEnd: Date
): number {
  const yearStart = new Date(Date.UTC(year, 0, 1));
  const yearEnd = new Date(Date.UTC(year, 11, 31));
  const overlapDays = overlapDaysInclusive(rangeStart, rangeEnd, yearStart, yearEnd);
  if (overlapDays <= 0) return 0;
  return Math.round((amountCents * overlapDays) / daysInYear(year));
}

function normalizeAmountCents(type: CategoryType, amount: number): number {
  const cents = Math.round(amount * 100);
  if (type === "income") return Math.abs(cents);
  if (type === "expense") return -Math.abs(cents);
  return cents;
}

function metricValueForRow(metric: Metric, row: Row): number | null {
  switch (metric) {
    case "netCashFlow":
      return row.netCashFlowCents;
    case "avgMonthlyCashFlow":
      return row.avgMonthlyCashFlowCents;
    case "yieldOnCostPct":
      return row.yieldOnCostPct;
    case "appreciationDollar":
      return row.appreciationCents;
    case "appreciationPct":
      return row.appreciationPct;
    case "totalReturnDollar":
      return row.totalReturnCents;
    case "totalReturnPct":
      return row.totalReturnPct;
    default:
      return null;
  }
}

function resolveCurrentValue(
  input: {
    soldPriceCents: number | null;
    zillowEstimatedValue: number | null;
    redfinEstimatedValue: number | null;
  },
  valuation: ValuationSource
): { valueCents: number | null; source: CurrentValueSource } {
  if (input.soldPriceCents != null) {
    return { valueCents: input.soldPriceCents, source: "sold" };
  }

  if (valuation === "zillow") {
    return input.zillowEstimatedValue != null
      ? { valueCents: input.zillowEstimatedValue * 100, source: "zillow" }
      : { valueCents: null, source: null };
  }

  if (valuation === "redfin") {
    return input.redfinEstimatedValue != null
      ? { valueCents: input.redfinEstimatedValue * 100, source: "redfin" }
      : { valueCents: null, source: null };
  }

  if (input.zillowEstimatedValue != null) {
    return { valueCents: input.zillowEstimatedValue * 100, source: "zillow" };
  }

  if (input.redfinEstimatedValue != null) {
    return { valueCents: input.redfinEstimatedValue * 100, source: "redfin" };
  }

  return { valueCents: null, source: null };
}

export async function getPortfolioLeaderboardReport(
  input: ReportInput
): Promise<Report> {
  const metric = input.metric ?? "netCashFlow";
  const status: StatusFilter = input.status ?? "active";
  const includeTransfers = Boolean(input.includeTransfers);
  const valuation = input.valuation ?? "auto";

  let startDate = parseYmd(input.start);
  let endDate = parseYmd(input.end);

  if (input.year) {
    const range = rangeFromYear(input.year);
    startDate = range.start;
    endDate = range.end;
  }

  if (startDate > endDate) {
    [startDate, endDate] = [endDate, startDate];
  }

  const [categories, properties] = await Promise.all([
    prisma.category.findMany({
      select: {
        id: true,
        type: true,
      },
    }),
    prisma.property.findMany({
      where: status === "all" ? undefined : { status },
      select: {
        id: true,
        nickname: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        status: true,
        purchasePriceCents: true,
        purchaseDate: true,
        soldPriceCents: true,
        zillowEstimatedValue: true,
        redfinEstimatedValue: true,
      },
    }),
  ]);

  const allowedCategoryIds = categories
    .filter((c) => includeTransfers || c.type !== "transfer")
    .map((c) => c.id);

  const propertyIds = properties.map((property) => property.id);
  const transactionalNetByProperty = new Map<string, number>();
  const annualNetByProperty = new Map<string, number>();

  if (propertyIds.length > 0 && allowedCategoryIds.length > 0) {
    const endDateExclusive = endExclusive(endDate);

    const transactions = await prisma.transaction.findMany({
      where: {
        propertyId: { in: propertyIds },
        categoryId: { in: allowedCategoryIds },
        deletedAt: null,
        date: {
          gte: startDate,
          lt: endDateExclusive,
        },
      },
      select: {
        propertyId: true,
        amount: true,
        category: { select: { type: true } },
      },
    });

    for (const transaction of transactions) {
      const normalized = normalizeAmountCents(transaction.category.type, transaction.amount);
      transactionalNetByProperty.set(
        transaction.propertyId,
        (transactionalNetByProperty.get(transaction.propertyId) ?? 0) + normalized
      );
    }

    const startYear = startDate.getUTCFullYear();
    const endYear = endDate.getUTCFullYear();
    const years: number[] = [];
    for (let year = startYear; year <= endYear; year += 1) {
      years.push(year);
    }

    if (years.length > 0) {
      const annualRows = await prisma.annualCategoryAmount.findMany({
        where: {
          propertyId: { in: propertyIds },
          categoryId: { in: allowedCategoryIds },
          year: { in: years },
        },
        select: {
          propertyId: true,
          year: true,
          amount: true,
          category: { select: { type: true } },
        },
      });

      for (const row of annualRows) {
        const normalized = normalizeAmountCents(row.category.type, row.amount);
        const prorated = prorateAnnualForRange(row.year, normalized, startDate, endDate);
        annualNetByProperty.set(
          row.propertyId,
          (annualNetByProperty.get(row.propertyId) ?? 0) + prorated
        );
      }
    }
  }

  let totalsTransactional = 0;
  let totalsAnnual = 0;

  const monthCount = monthCountInclusive(startDate, endDate);

  const rows: Row[] = properties.map((property) => {
    const transactionalNetCents = transactionalNetByProperty.get(property.id) ?? 0;
    const annualNetCents = annualNetByProperty.get(property.id) ?? 0;
    const netCashFlowCents = transactionalNetCents + annualNetCents;
    const avgMonthlyCashFlowCents = Math.round(netCashFlowCents / monthCount);

    totalsTransactional += transactionalNetCents;
    totalsAnnual += annualNetCents;

    const purchasePriceCents = property.purchasePriceCents ?? null;
    const purchaseDate = property.purchaseDate ? formatYmd(property.purchaseDate) : null;

    const currentValue = resolveCurrentValue(
      {
        soldPriceCents: property.soldPriceCents ?? null,
        zillowEstimatedValue: property.zillowEstimatedValue ?? null,
        redfinEstimatedValue: property.redfinEstimatedValue ?? null,
      },
      valuation
    );

    const yieldOnCostPct =
      purchasePriceCents && purchasePriceCents > 0
        ? (netCashFlowCents / purchasePriceCents) * 100
        : null;

    const appreciationCents =
      purchasePriceCents != null && currentValue.valueCents != null
        ? currentValue.valueCents - purchasePriceCents
        : null;

    const appreciationPct =
      purchasePriceCents && purchasePriceCents > 0 && appreciationCents != null
        ? (appreciationCents / purchasePriceCents) * 100
        : null;

    const totalReturnCents = appreciationCents != null ? netCashFlowCents + appreciationCents : null;

    const totalReturnPct =
      purchasePriceCents && purchasePriceCents > 0 && totalReturnCents != null
        ? (totalReturnCents / purchasePriceCents) * 100
        : null;

    const row: Row = {
      propertyId: property.id,
      propertyLabel: propertyLabel(property),
      status: property.status,
      purchasePriceCents,
      purchaseDate,
      currentValueCents: currentValue.valueCents,
      currentValueSource: currentValue.source,
      transactionalNetCents,
      annualNetCents,
      netCashFlowCents,
      avgMonthlyCashFlowCents,
      yieldOnCostPct,
      appreciationCents,
      appreciationPct,
      totalReturnCents,
      totalReturnPct,
      rankValue: null,
    };

    row.rankValue = metricValueForRow(metric, row);

    return row;
  });

  rows.sort((a, b) => {
    if (a.rankValue == null && b.rankValue == null) return 0;
    if (a.rankValue == null) return 1;
    if (b.rankValue == null) return -1;
    return b.rankValue - a.rankValue;
  });

  return {
    input: {
      metric,
      year: input.year,
      start: formatYmd(startDate),
      end: formatYmd(endDate),
      status,
      includeTransfers,
      valuation,
    },
    rows,
    totals: {
      transactionalNetCents: totalsTransactional,
      annualNetCents: totalsAnnual,
      netCashFlowCents: totalsTransactional + totalsAnnual,
    },
    notes: {
      usesCurrentAppreciation: true,
    },
  };
}
