import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { getProfitLossByProperty, type ProfitLossRow } from "@/lib/reports/profitLossByProperty";

export type ValuationSource = "zillow" | "redfin";

export type ReturnOnEquityRow = {
  propertyId: string;
  propertyLabel: string;
  value: number | null;
  loanBalance: number;
  equity: number | null;
  netCashFlow: number;
  roePct: number | null;
};

export type ReturnOnEquityReport = {
  rows: ReturnOnEquityRow[];
  profitLossRows: ProfitLossRow[];
  year: number;
};

type ReturnOnEquityInput = {
  year: number;
  valuation: ValuationSource;
  propertyId?: string | null;
};

function rangeFromYear(year: number) {
  return {
    startDate: new Date(Date.UTC(year, 0, 1)),
    endDate: new Date(Date.UTC(year, 11, 31)),
  };
}

function resolveValuation(
  input: { zillowEstimatedValue: number | null; redfinEstimatedValue: number | null },
  valuation: ValuationSource
) {
  return valuation === "redfin" ? input.redfinEstimatedValue : input.zillowEstimatedValue;
}

export async function getReturnOnEquityReport(
  input: ReturnOnEquityInput
): Promise<ReturnOnEquityReport> {
  const { startDate, endDate } = rangeFromYear(input.year);

  const properties = await prisma.property.findMany({
    where: input.propertyId ? { id: input.propertyId } : undefined,
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
      zillowEstimatedValue: true,
      redfinEstimatedValue: true,
    },
  });

  const propertyIds = properties.map((property) => property.id);

  const profitLoss = await getProfitLossByProperty({
    propertyId: input.propertyId ?? null,
    startDate,
    endDate,
    includeTransfers: false,
    includeAnnualTotals: true,
  });

  const loanBalanceByProperty = new Map<string, number>();

  if (propertyIds.length > 0) {
    const loans = await prisma.loan.findMany({
      where: { propertyId: { in: propertyIds } },
      select: {
        propertyId: true,
        snapshots: {
          orderBy: { asOfDate: "desc" },
          take: 1,
          select: { balance: true },
        },
      },
    });

    for (const loan of loans) {
      const balance = loan.snapshots[0]?.balance ?? 0;
      loanBalanceByProperty.set(
        loan.propertyId,
        (loanBalanceByProperty.get(loan.propertyId) ?? 0) + balance
      );
    }
  }

  const rows = properties.map((property) => {
    const value = resolveValuation(
      {
        zillowEstimatedValue: property.zillowEstimatedValue ?? null,
        redfinEstimatedValue: property.redfinEstimatedValue ?? null,
      },
      input.valuation
    );

    const loanBalance = loanBalanceByProperty.get(property.id) ?? 0;
    const equity = value == null ? null : value - loanBalance;
    const netCashFlow = profitLoss.subtotalsByProperty[property.id]?.netTotal ?? 0;
    const roePct = equity != null && equity > 0 ? (netCashFlow / equity) * 100 : null;

    return {
      propertyId: property.id,
      propertyLabel: propertyLabel(property),
      value,
      loanBalance,
      equity,
      netCashFlow,
      roePct,
    } satisfies ReturnOnEquityRow;
  });

  rows.sort((a, b) => {
    if (a.roePct == null && b.roePct == null) {
      return a.propertyLabel.localeCompare(b.propertyLabel);
    }
    if (a.roePct == null) return 1;
    if (b.roePct == null) return -1;
    return b.roePct - a.roePct;
  });

  return {
    rows,
    profitLossRows: profitLoss.rows,
    year: input.year,
  };
}
