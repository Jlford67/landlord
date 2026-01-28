"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { formatUsd } from "@/lib/money";
import { AmountCell } from "@/components/ui/AmountCell";
import type { NetProfitRow, NetProfitYears } from "@/lib/reports/netProfit";

const GREEN_DARK: [number, number, number] = [22, 163, 74];
const GREEN_LIGHT: [number, number, number] = [220, 252, 231];
const RED_DARK: [number, number, number] = [220, 38, 38];
const RED_LIGHT: [number, number, number] = [254, 226, 226];
const NEUTRAL = "#94a3b8";

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}

function mixColor(
  light: [number, number, number],
  dark: [number, number, number],
  intensity: number
) {
  const t = clamp(intensity);
  const r = Math.round(light[0] + (dark[0] - light[0]) * t);
  const g = Math.round(light[1] + (dark[1] - light[1]) * t);
  const b = Math.round(light[2] + (dark[2] - light[2]) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

function formatAccounting(amount: number) {
  const abs = formatUsd(Math.abs(amount));
  return amount < 0 ? `(${abs})` : abs;
}

export default function NetProfitLeaderboardClient({
  rows,
  years,
}: {
  rows: NetProfitRow[];
  years: NetProfitYears;
}) {
  const router = useRouter();

  const sortedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      if (a.netProfit !== b.netProfit) return b.netProfit - a.netProfit;
      return a.propertyName.localeCompare(b.propertyName);
    });
    return copy;
  }, [rows]);

  const chartData = useMemo(() => {
    const maxPositive = Math.max(
      0,
      ...sortedRows.filter((row) => row.netProfit > 0).map((row) => row.netProfit)
    );
    const maxNegativeAbs = Math.max(
      0,
      ...sortedRows.filter((row) => row.netProfit < 0).map((row) => Math.abs(row.netProfit))
    );

    return sortedRows.map((row) => {
      if (row.netProfit > 0 && maxPositive > 0) {
        const intensity = row.netProfit / maxPositive;
        return { ...row, fill: mixColor(GREEN_LIGHT, GREEN_DARK, intensity) };
      }
      if (row.netProfit < 0 && maxNegativeAbs > 0) {
        const intensity = Math.abs(row.netProfit) / maxNegativeAbs;
        return { ...row, fill: mixColor(RED_LIGHT, RED_DARK, intensity) };
      }
      return { ...row, fill: NEUTRAL };
    });
  }, [sortedRows]);

  const maxAbs = useMemo(() => {
    return Math.max(0, ...sortedRows.map((row) => Math.abs(row.netProfit)));
  }, [sortedRows]);

  const handleRowClick = (propertyId: string) => {
    const params = new URLSearchParams();
    params.set("years", years);
    router.push(`/reports/net-profit/${propertyId}?${params.toString()}`);
  };

  if (sortedRows.length === 0) {
    return (
      <div className="ll_card">
        <p className="ll_muted">No net profit data for the selected period.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="ll_card" style={{ height: 440 }}>
        <div className="px-4 pt-4 text-sm font-semibold text-slate-900">Net profit by property</div>
        <div style={{ width: "100%", height: 380 }}>
          <ResponsiveContainer>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 10, right: 24, left: 12, bottom: 10 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                domain={maxAbs === 0 ? [0, 0] : [-maxAbs, maxAbs]}
                tickFormatter={(value) => formatUsd(Number(value))}
              />
              <YAxis
                type="category"
                dataKey="propertyName"
                width={180}
                tick={{ fontSize: 12 }}
              />
              <Tooltip
                formatter={(value) => formatAccounting(Number(value))}
                cursor={{ fill: "rgba(15, 23, 42, 0.04)" }}
              />
              <ReferenceLine x={0} stroke="#94a3b8" />
              <Bar dataKey="netProfit" isAnimationActive={false}>
                {chartData.map((entry) => (
                  <Cell key={entry.propertyId} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="ll_card ll_table_wrap">
        <table className="ll_table ll_table_zebra w-full">
          <thead>
            <tr>
              <th>Property</th>
              <th className="w-40 text-right">Net profit</th>
              <th className="w-24"> </th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row) => (
              <tr
                key={row.propertyId}
                className="cursor-pointer"
                onClick={() => handleRowClick(row.propertyId)}
              >
                <td className="font-medium text-slate-900">{row.propertyName}</td>
                <td className="text-right">
                  <AmountCell amount={row.netProfit} />
                </td>
                <td>
                  <Link
                    href={`/reports/net-profit/${row.propertyId}?years=${years}`}
                    className="ll_link"
                    onClick={(event) => event.stopPropagation()}
                  >
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
