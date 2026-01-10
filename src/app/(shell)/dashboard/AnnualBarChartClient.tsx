"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type AnnualBarChartClientProps = {
  data: Array<{ year: number; net: number }>;
};

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export default function AnnualBarChartClient({ data }: AnnualBarChartClientProps) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
        <XAxis dataKey="year" tickLine={false} axisLine={false} />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => currencyFormatter.format(Number(value))}
        />
        <Tooltip
          formatter={(value) => currencyFormatter.format(Number(value))}
          labelFormatter={(label) => `Year ${label}`}
        />
        <Bar dataKey="net" radius={[4, 4, 0, 0]}>
          {data.map((entry) => {
            const fill = entry.net < 0 ? "#dc2626" : entry.net > 0 ? "#059669" : "#374151";
            return <Cell key={`cell-${entry.year}`} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
