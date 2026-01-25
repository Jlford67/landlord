"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

function TrendTooltip({ active, label, payload, rawByYear, propertyLabelMap }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const yearLabel = Number(label);
  if (!Number.isFinite(yearLabel)) return null;
  const rawRow = rawByYear.get(yearLabel);
  const uniqueEntries = new Map<string, { dataKey: string; value: number }>();
  payload.forEach((entry) => {
    const key = String(entry.dataKey ?? "");
    if (!key || uniqueEntries.has(key)) return;
    uniqueEntries.set(key, { dataKey: key, value: Number(entry.value ?? 0) });
  });
  const entries = Array.from(uniqueEntries.values());

  return (
    <div className="ll_card" style={{ padding: 12, minWidth: 200 }}>
      <div className="text-sm font-semibold text-slate-900">Year {yearLabel}</div>
      <div className="mt-2 space-y-2 text-sm">
        {entries.map((entry) => {
          const displayed = entry.value;
          const raw = Number(rawRow?.[entry.dataKey] ?? 0);
          const labelText = propertyLabelMap.get(entry.dataKey) ?? "Property";
          return (
            <div key={entry.dataKey} className="space-y-1">
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
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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
            {mounted ? (
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
            ) : (
              <div className="ll_input" style={{ height: 40 }} aria-hidden="true" />
            )}
          </div>

          <div>
            <label className="ll_label" htmlFor="expenseProperty">
              Property (optional)
            </label>
            {mounted ? (
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
            ) : (
              <div className="ll_input" style={{ height: 40 }} aria-hidden="true" />
            )}
          </div>

          <div>
            <label className="ll_label" htmlFor="positiveToggle">
              Show expenses as positive
            </label>
            <div className="flex items-center gap-2 pt-2">
              {mounted ? (
                <>
                  <input
                    id="positiveToggle"
                    type="checkbox"
                    className="h-4 w-4"
                    checked={positive}
                    onChange={(event) => setPositive(event.target.checked)}
                    suppressHydrationWarning
                  />
                  <span className="text-sm text-slate-700">{positive ? "On" : "Off"}</span>
                </>
              ) : (
                <>
                  <div
                    className="h-4 w-4 rounded border border-slate-300 bg-slate-100"
                    aria-hidden="true"
                  />
                  <span className="text-sm text-slate-400" aria-hidden="true">
                    Loading
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="ll_actions" style={{ marginTop: 8 }}>
          {mounted ? (
            <Button
              type="button"
              variant="warning"
              size="md"
              onClick={handleApply}
              disabled={!categoryId}
            >
              Apply filters
            </Button>
          ) : (
            <span className="ll_btnWarning opacity-50" aria-hidden="true">
              Apply filters
            </span>
          )}
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
              <ComposedChart
                data={chartData}
                margin={{ top: 10, right: 20, bottom: 10, left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis
                  width={90}
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
                {report.properties.map((property) => (
                  <Bar key={`bar-${property.id}`} dataKey={property.id} />
                ))}
                {report.properties.map((property) => (
                  <Line
                    key={`line-${property.id}`}
                    type="monotone"
                    dataKey={property.id}
                    strokeWidth={2}
                    dot={false}
                  />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
