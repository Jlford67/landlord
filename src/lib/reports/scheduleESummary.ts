import { CategoryType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";

export type BucketKey =
  | "rentsReceived"
  | "otherIncome"
  | "advertising"
  | "autoTravel"
  | "cleaningMaintenance"
  | "commissions"
  | "insurance"
  | "legalProfessional"
  | "managementFees"
  | "mortgageInterest"
  | "otherInterest"
  | "repairs"
  | "supplies"
  | "taxes"
  | "utilities"
  | "otherExpenses";

export type BucketRow = {
  key: BucketKey;
  label: string;
  transactionalCents: number;
  annualCents: number;
  combinedCents: number;
};

export type PropertyRow = {
  propertyId: string;
  propertyLabel: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
};

export type ScheduleESummaryInput = {
  year?: number;
  start?: string;
  end?: string;
  propertyId?: string;
  includeTransfers?: boolean;
  mode?: "combined" | "transactionalOnly" | "annualOnly";
};

export type ScheduleESummaryReport = {
  input: {
    year?: number;
    start: string;
    end: string;
    propertyId?: string;
    includeTransfers: boolean;
    mode: "combined" | "transactionalOnly" | "annualOnly";
  };
  income: {
    rentsReceivedCents: number;
    otherIncomeCents: number;
    totalIncomeCents: number;
  };
  expenses: {
    totalExpenseCents: number;
    buckets: BucketRow[];
  };
  netCents: number;
  byProperty?: {
    rows: PropertyRow[];
    totals: { incomeCents: number; expenseCents: number; netCents: number };
  };
};

const bucketLabels: Record<BucketKey, string> = {
  rentsReceived: "Rents received",
  otherIncome: "Other income",
  advertising: "Advertising",
  autoTravel: "Auto and travel",
  cleaningMaintenance: "Cleaning and maintenance",
  commissions: "Commissions",
  insurance: "Insurance",
  legalProfessional: "Legal and professional fees",
  managementFees: "Management fees",
  mortgageInterest: "Mortgage interest",
  otherInterest: "Other interest",
  repairs: "Repairs",
  supplies: "Supplies",
  taxes: "Taxes",
  utilities: "Utilities",
  otherExpenses: "Other expenses",
};

const expenseBucketKeys: BucketKey[] = [
  "advertising",
  "autoTravel",
  "cleaningMaintenance",
  "commissions",
  "insurance",
  "legalProfessional",
  "managementFees",
  "mortgageInterest",
  "otherInterest",
  "repairs",
  "supplies",
  "taxes",
  "utilities",
  "otherExpenses",
];

const explicitBucketFields = [
  "scheduleEBucket",
  "taxBucket",
  "taxLine",
  "reportingGroup",
];

const explicitBucketMap: Record<string, BucketKey> = {
  rentsreceived: "rentsReceived",
  rentalincome: "rentsReceived",
  rent: "rentsReceived",
  otherincome: "otherIncome",
  advertising: "advertising",
  autotravel: "autoTravel",
  autoandtravel: "autoTravel",
  cleaningmaintenance: "cleaningMaintenance",
  cleaning: "cleaningMaintenance",
  maintenance: "cleaningMaintenance",
  commissions: "commissions",
  insurance: "insurance",
  legalprofessional: "legalProfessional",
  legalfees: "legalProfessional",
  professionalfees: "legalProfessional",
  managementfees: "managementFees",
  management: "managementFees",
  mortgageinterest: "mortgageInterest",
  otherinterest: "otherInterest",
  repairs: "repairs",
  supplies: "supplies",
  taxes: "taxes",
  utilities: "utilities",
  otherexpenses: "otherExpenses",
};

function parseYmd(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid date: ${value}`);
  }
  const [yy, mm, dd] = value.split("-").map(Number);
  return new Date(Date.UTC(yy, mm - 1, dd));
}

function parseYmdOrNull(value?: string): Date | null {
  if (!value) return null;
  try {
    return parseYmd(value);
  } catch {
    return null;
  }
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

function rangeFromYear(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, 0, 1)),
    end: new Date(Date.UTC(year, 11, 31)),
  };
}

function daysInYear(year: number): number {
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year + 1, 0, 1);
  return Math.round((end - start) / 86_400_000);
}

function overlapDaysInclusive(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date
): number {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start > end) return 0;
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
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
  const fraction = overlapDays / daysInYear(year);
  return Math.round(amountCents * fraction);
}

function normalizeBucketValue(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function bucketFromExplicit(value: string): BucketKey | null {
  const normalized = normalizeBucketValue(value);
  return explicitBucketMap[normalized] ?? null;
}

function bucketForCategory(
  category: { name: string; type: CategoryType } & Record<string, unknown>,
  effectiveType: "income" | "expense"
): BucketKey {
  for (const field of explicitBucketFields) {
    const raw = category[field];
    if (typeof raw === "string" && raw.trim()) {
      const bucket = bucketFromExplicit(raw);
      if (bucket) return bucket;
    }
  }

  const name = category.name.toLowerCase();

  if (effectiveType === "income") {
    if (name.includes("rent") || name.includes("rental") || name.includes("lease")) {
      return "rentsReceived";
    }
    return "otherIncome";
  }

  if (name.includes("depreciation")) return "otherExpenses";
  if (/advert|marketing/.test(name)) return "advertising";
  if (/mileage|auto|travel|uber|lyft|gas/.test(name)) return "autoTravel";
  if (/clean|janitor|maintenance/.test(name)) return "cleaningMaintenance";
  if (/commission/.test(name)) return "commissions";
  if (/insurance/.test(name)) return "insurance";
  if (/legal|attorney|accounting|cpa|professional/.test(name)) {
    return "legalProfessional";
  }
  if (/management|property manager|pm fee/.test(name)) return "managementFees";
  if (/mortgage interest|interest\s*-\s*mortgage/.test(name)) {
    return "mortgageInterest";
  }
  if (/interest/.test(name)) return "otherInterest";
  if (/repair|fix|plumbing|electrical|hvac/.test(name)) return "repairs";
  if (/supplies|materials/.test(name)) return "supplies";
  if (/property tax|tax/.test(name)) return "taxes";
  if (/water|gas|electric|trash|sewer|utility|internet|cable/.test(name)) {
    return "utilities";
  }

  return "otherExpenses";
}

function normalizedAmountCents(type: "income" | "expense", amountCents: number): number {
  // Normalize to expected sign for tax-style reporting, regardless of data import quirks.
  if (type === "income") return Math.abs(amountCents);
  return -Math.abs(amountCents);
}

function centsFromAmount(amount: number): number {
  return Math.round(amount * 100);
}

export async function getScheduleESummaryReport(
  input: ScheduleESummaryInput
): Promise<ScheduleESummaryReport> {
  const includeTransfers = Boolean(input.includeTransfers);
  const mode = input.mode ?? "combined";

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const requestedYear = Number.isInteger(input.year) ? input.year : undefined;

  const parsedStart = parseYmdOrNull(input.start);
  const parsedEnd = parseYmdOrNull(input.end);

  let rangeStart: Date;
  let rangeEnd: Date;

  if (requestedYear) {
    const range = rangeFromYear(requestedYear);
    rangeStart = range.start;
    rangeEnd = range.end;
  } else {
    const fallback = rangeFromYear(currentYear);
    rangeStart = parsedStart ?? fallback.start;
    rangeEnd = parsedEnd ?? fallback.end;
    if (rangeStart > rangeEnd) {
      [rangeStart, rangeEnd] = [rangeEnd, rangeStart];
    }
  }

  const includeByProperty = !input.propertyId;
  const properties = includeByProperty
    ? await prisma.property.findMany({
        select: {
          id: true,
          nickname: true,
          street: true,
          city: true,
          state: true,
          zip: true,
        },
      })
    : [];

  const propertyMap = new Map(
    properties.map((p) => [
      p.id,
      propertyLabel({
        nickname: p.nickname,
        street: p.street,
        city: p.city,
        state: p.state,
        zip: p.zip,
      }),
    ])
  );

  const incomeTotals = {
    transactional: { rentsReceivedCents: 0, otherIncomeCents: 0 },
    annual: { rentsReceivedCents: 0, otherIncomeCents: 0 },
  };

  const expenseTotals = new Map<BucketKey, { transactionalCents: number; annualCents: number }>();
  expenseBucketKeys.forEach((key) => {
    expenseTotals.set(key, { transactionalCents: 0, annualCents: 0 });
  });

  const propertyTotals = new Map<
    string,
    {
      propertyId: string;
      propertyLabel: string;
      transactionalIncomeCents: number;
      transactionalExpenseCents: number;
      annualIncomeCents: number;
      annualExpenseCents: number;
    }
  >();

  function ensurePropertyTotals(propertyId: string) {
    if (!includeByProperty) return;
    if (!propertyTotals.has(propertyId)) {
      propertyTotals.set(propertyId, {
        propertyId,
        propertyLabel: propertyMap.get(propertyId) ?? "Unknown property",
        transactionalIncomeCents: 0,
        transactionalExpenseCents: 0,
        annualIncomeCents: 0,
        annualExpenseCents: 0,
      });
    }
  }

  function applyAmount(inputData: {
    amountCents: number;
    category: { name: string; type: CategoryType } & Record<string, unknown>;
    propertyId: string;
    source: "transactional" | "annual";
  }) {
    const effectiveType =
      inputData.category.type === "transfer"
        ? inputData.amountCents >= 0
          ? "income"
          : "expense"
        : inputData.category.type;

    const normalized = normalizedAmountCents(effectiveType, inputData.amountCents);
    const bucket = bucketForCategory(inputData.category, effectiveType);

    if (bucket === "rentsReceived" || bucket === "otherIncome") {
      if (inputData.source === "transactional") {
        incomeTotals.transactional[`${bucket}Cents` as const] += normalized;
      } else {
        incomeTotals.annual[`${bucket}Cents` as const] += normalized;
      }
    } else {
      const totals = expenseTotals.get(bucket);
      if (totals) {
        if (inputData.source === "transactional") {
          totals.transactionalCents += normalized;
        } else {
          totals.annualCents += normalized;
        }
      }
    }

    if (includeByProperty) {
      ensurePropertyTotals(inputData.propertyId);
      const row = propertyTotals.get(inputData.propertyId);
      if (row) {
        if (effectiveType === "income") {
          if (inputData.source === "transactional") {
            row.transactionalIncomeCents += normalized;
          } else {
            row.annualIncomeCents += normalized;
          }
        } else {
          if (inputData.source === "transactional") {
            row.transactionalExpenseCents += normalized;
          } else {
            row.annualExpenseCents += normalized;
          }
        }
      }
    }
  }

  const endExclusiveDate = endExclusive(rangeEnd);

  if (mode !== "annualOnly") {
    const transactional = await prisma.transaction.findMany({
      where: {
        propertyId: input.propertyId || undefined,
        deletedAt: null,
        date: {
          gte: rangeStart,
          lt: endExclusiveDate,
        },
        category: {
          type: {
            in: includeTransfers
              ? ["income", "expense", "transfer"]
              : ["income", "expense"],
          },
        },
      },
      select: {
        amount: true,
        propertyId: true,
        category: true,
      },
    });

    for (const row of transactional) {
      applyAmount({
        amountCents: centsFromAmount(Number(row.amount ?? 0)),
        category: row.category,
        propertyId: row.propertyId,
        source: "transactional",
      });
    }
  }

  if (mode !== "transactionalOnly") {
    const startYear = rangeStart.getUTCFullYear();
    const endYear = rangeEnd.getUTCFullYear();
    const years: number[] = [];
    for (let y = startYear; y <= endYear; y += 1) {
      years.push(y);
    }

    if (years.length > 0) {
      const annualRows = await prisma.annualCategoryAmount.findMany({
        where: {
          propertyId: input.propertyId || undefined,
          year: { in: years },
          category: {
            type: { in: ["income", "expense"] },
          },
        },
        select: {
          propertyId: true,
          amount: true,
          year: true,
          category: true,
        },
      });

      for (const row of annualRows) {
        const amountCents = centsFromAmount(Number(row.amount ?? 0));
        const prorated = prorateAnnualForRange(
          row.year,
          amountCents,
          rangeStart,
          rangeEnd
        );
        if (prorated === 0) continue;
        applyAmount({
          amountCents: prorated,
          category: row.category,
          propertyId: row.propertyId,
          source: "annual",
        });
      }
    }
  }

  const rentsReceivedCents =
    (mode === "annualOnly" ? 0 : incomeTotals.transactional.rentsReceivedCents) +
    (mode === "transactionalOnly" ? 0 : incomeTotals.annual.rentsReceivedCents);
  const otherIncomeCents =
    (mode === "annualOnly" ? 0 : incomeTotals.transactional.otherIncomeCents) +
    (mode === "transactionalOnly" ? 0 : incomeTotals.annual.otherIncomeCents);
  const totalIncomeCents = rentsReceivedCents + otherIncomeCents;

  const buckets: BucketRow[] = expenseBucketKeys.map((key) => {
    const totals = expenseTotals.get(key) ?? { transactionalCents: 0, annualCents: 0 };
    const transactionalCents =
      mode === "annualOnly" ? 0 : totals.transactionalCents;
    const annualCents = mode === "transactionalOnly" ? 0 : totals.annualCents;
    return {
      key,
      label: bucketLabels[key],
      transactionalCents,
      annualCents,
      combinedCents: transactionalCents + annualCents,
    };
  });

  const totalExpenseCents = buckets.reduce(
    (sum, bucket) => sum + bucket.combinedCents,
    0
  );

  const netCents = totalIncomeCents + totalExpenseCents;

  let byProperty: ScheduleESummaryReport["byProperty"];
  if (includeByProperty) {
    const rows = Array.from(propertyTotals.values()).map((row) => {
      const incomeCents =
        (mode === "annualOnly" ? 0 : row.transactionalIncomeCents) +
        (mode === "transactionalOnly" ? 0 : row.annualIncomeCents);
      const expenseCents =
        (mode === "annualOnly" ? 0 : row.transactionalExpenseCents) +
        (mode === "transactionalOnly" ? 0 : row.annualExpenseCents);
      const netCents = incomeCents + expenseCents;
      return {
        propertyId: row.propertyId,
        propertyLabel: row.propertyLabel,
        incomeCents,
        expenseCents,
        netCents,
      };
    });

    rows.sort((a, b) => b.netCents - a.netCents);

    const totals = rows.reduce(
      (acc, row) => {
        acc.incomeCents += row.incomeCents;
        acc.expenseCents += row.expenseCents;
        acc.netCents += row.netCents;
        return acc;
      },
      { incomeCents: 0, expenseCents: 0, netCents: 0 }
    );

    byProperty = { rows, totals };
  }

  return {
    input: {
      year: requestedYear,
      start: formatYmd(rangeStart),
      end: formatYmd(rangeEnd),
      propertyId: input.propertyId || undefined,
      includeTransfers,
      mode,
    },
    income: {
      rentsReceivedCents,
      otherIncomeCents,
      totalIncomeCents,
    },
    expenses: {
      totalExpenseCents,
      buckets,
    },
    netCents,
    byProperty,
  };
}
