"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Button from "@/components/ui/Button";
import { formatUsd } from "@/lib/money";
import type { ExpenseTrendResult } from "@/lib/reports/expenseTrendByYear";

type Option = { id: string; label: string };

type ExpenseTrendClientProps = {
  categoryOptions: Option[];
  propertyOptions: Option[];
  selectedCategoryId?: string;
  selectedPropertyId?: string;
  showPositive: boolean;
  report: ExpenseTrendResult;
};

type TooltipProps = {
  active?: boolean;
  label?: number | string;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  rawByYear: Map<number, { year: number; [propertyId: string]: number }>;
  propertyLabelMap: Map<string, string>;
};

const lineColors = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#dc2626",
  "#7c3aed",
  "#0ea5e9",
  "#14b8a6",
  "#9333ea",
];

function TrendTooltip({ active, label, payload, rawByYear, propertyLabelMap }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const yearLabel = Number(label);
  if (!Number.isFinite(yearLabel)) return null;
  const rawRow = rawByYear.get(yearLabel);

  return (
    <div className="ll_card" style={{ padding: 12, minWidth: 200 }}>
      <div className="text-sm font-semibold text-slate-900">Year {yearLabel}</div>
      <div className="mt-2 space-y-2 text-sm">
        {payload.map((entry) => {
          const key = String(entry.dataKey ?? "");
          const displayed = Number(entry.value ?? 0);
          const raw = Number(rawRow?.[key] ?? 0);
          const labelText = propertyLabelMap.get(key) ?? "Property";
          return (
            <div key={key} className="space-y-1">
              <div className="font-medium text-slate-900">{labelText}</div>
              <div className="text-xs text-slate-600">Displayed: {formatUsd(displayed)}</div>
              <div className="text-xs text-slate-500">Raw: {formatUsd(raw)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ExpenseTrendClient({
  categoryOptions,
  propertyOptions,
  selectedCategoryId,
  selectedPropertyId,
  showPositive,
  report,
}: ExpenseTrendClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [categoryId, setCategoryId] = useState(selectedCategoryId ?? "");
  const [propertyId, setPropertyId] = useState(selectedPropertyId ?? "");
  const [positive, setPositive] = useState(showPositive);

  useEffect(() => {
    setCategoryId(selectedCategoryId ?? "");
  }, [selectedCategoryId]);

  useEffect(() => {
    setPropertyId(selectedPropertyId ?? "");
  }, [selectedPropertyId]);

  useEffect(() => {
    setPositive(showPositive);
  }, [showPositive]);

  const chartData = positive ? report.seriesDisplay : report.seriesRaw;

  const rawByYear = useMemo(() => {
    const map = new Map<number, { year: number; [propertyId: string]: number }>();
    report.seriesRaw.forEach((row) => map.set(row.year, row));
    return map;
  }, [report.seriesRaw]);

  const propertyLabelMap = useMemo(() => {
    return new Map(report.properties.map((p) => [p.id, p.label]));
  }, [report.properties]);

  const handleApply = () => {
    if (!categoryId) return;
    const params = new URLSearchParams();
    params.set("categoryId", categoryId);
    if (propertyId) params.set("propertyId", propertyId);
    params.set("positive", positive ? "1" : "0");
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="ll_stack" style={{ gap: 16 }}>
      <div className="ll_card ll_stack" style={{ gap: 16 }}>
        <div className="ll_rowBetween items-center gap-3">
          <h2 className="text-base font-semibold text-slate-900">Filters</h2>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <label className="ll_label" htmlFor="expenseCategory">
              Category (required)
            </label>
            <select
              id="expenseCategory"
              className="ll_input"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              suppressHydrationWarning
            >
              <option value="">Select a category</option>
              {categoryOptions.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ll_label" htmlFor="expenseProperty">
              Property (optional)
            </label>
            <select
              id="expenseProperty"
              className="ll_input"
              value={propertyId}
              onChange={(event) => setPropertyId(event.target.value)}
              suppressHydrationWarning
            >
              <option value="">All properties</option>
              {propertyOptions.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="ll_label" htmlFor="positiveToggle">
              Show expenses as positive
            </label>
            <div className="flex items-center gap-2 pt-2">
              <input
                id="positiveToggle"
                type="checkbox"
                className="h-4 w-4"
                checked={positive}
                onChange={(event) => setPositive(event.target.checked)}
                suppressHydrationWarning
              />
              <span className="text-sm text-slate-700">{positive ? "On" : "Off"}</span>
            </div>
          </div>
        </div>

        <div className="ll_actions" style={{ marginTop: 8 }}>
          <Button
            type="button"
            variant="warning"
            size="md"
            onClick={handleApply}
            disabled={!categoryId}
          >
            Apply filters
          </Button>
        </div>
      </div>

      <div className="ll_card ll_stack" style={{ gap: 12 }}>
        <div className="ll_rowBetween items-start gap-3">
          <div className="ll_stack" style={{ gap: 4 }}>
            <h2 className="text-base font-semibold text-slate-900">Expense trend by year</h2>
            <p className="ll_muted text-sm">
              Totals combine annual category amounts and ledger transactions.
            </p>
          </div>
        </div>

        {!categoryId ? (
          <p className="ll_muted text-sm">Select a category to see yearly totals.</p>
        ) : chartData.length === 0 || report.properties.length === 0 ? (
          <p className="ll_muted text-sm">No data available for the current filters.</p>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatUsd(Number(value))}
                />
                <Tooltip
                  content={
                    <TrendTooltip rawByYear={rawByYear} propertyLabelMap={propertyLabelMap} />
                  }
                />
                <Legend
                  formatter={(value) => propertyLabelMap.get(String(value)) ?? String(value)}
                />
                {report.properties.map((property, index) => (
                  <Line
                    key={property.id}
                    type="monotone"
                    dataKey={property.id}
                    stroke={lineColors[index % lineColors.length]}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
