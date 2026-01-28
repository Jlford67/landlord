import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { getProfitLossByProperty } from "@/lib/reports/profitLossByProperty";

export type NetProfitYears = "1" | "3" | "5" | "10" | "15" | "all";

export type NetProfitRow = {
  propertyId: string;
  propertyName: string;
  netProfit: number;
  income?: number;
  expenses?: number;
};

function todayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function startForYears(years: NetProfitYears): Date {
  if (years === "all") return new Date(0);
  const count = Number(years);
  const now = todayUtc();
  return new Date(Date.UTC(now.getUTCFullYear() - count, now.getUTCMonth(), now.getUTCDate()));
}

export function getNetProfitRange(years: NetProfitYears): { startDate: Date; endDate: Date } {
  const endDate = todayUtc();
  const startDate = startForYears(years);
  return { startDate, endDate };
}

export async function getNetProfitByProperty({
  years,
}: {
  years: NetProfitYears;
}): Promise<NetProfitRow[]> {
  const { startDate, endDate } = getNetProfitRange(years);
  const report = await getProfitLossByProperty({
    startDate,
    endDate,
    includeTransfers: false,
  });

  const rows = Object.values(report.subtotalsByProperty).map((subtotal) => ({
    propertyId: subtotal.propertyId,
    propertyName: subtotal.propertyName,
    netProfit: subtotal.netTotal,
  }));

  rows.sort((a, b) => {
    if (a.netProfit !== b.netProfit) return b.netProfit - a.netProfit;
    return a.propertyName.localeCompare(b.propertyName);
  });

  return rows;
}

export async function getNetProfitForProperty({
  propertyId,
  years,
}: {
  propertyId: string;
  years: NetProfitYears;
}): Promise<NetProfitRow> {
  const { startDate, endDate } = getNetProfitRange(years);
  const report = await getProfitLossByProperty({
    startDate,
    endDate,
    includeTransfers: false,
    propertyId,
  });

  const subtotal = report.subtotalsByProperty[propertyId];

  if (subtotal) {
    return {
      propertyId,
      propertyName: subtotal.propertyName,
      netProfit: subtotal.netTotal,
      income: subtotal.incomeTotal,
      expenses: subtotal.expenseTotal,
    };
  }

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  return {
    propertyId,
    propertyName: property ? propertyLabel(property) : "Unknown property",
    netProfit: 0,
    income: 0,
    expenses: 0,
  };
}
