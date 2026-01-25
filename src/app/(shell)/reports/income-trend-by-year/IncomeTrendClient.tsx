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
import type { IncomeTrendResult } from "@/lib/reports/incomeTrendByYear";

type Option = { id: string; label: string };

type IncomeTrendClientProps = {
  categoryOptions: Option[];
  propertyOptions: Option[];
  selectedCategoryId?: string;
  selectedPropertyId?: string;
  report: IncomeTrendResult;
};

type TooltipProps = {
  active?: boolean;
  label?: number | string;
  payload?: Array<{ dataKey?: string | number; value?: number; color?: string }>;
  propertyLabelMap: Map<string, string>;
};

const PALETTE = [
  "#16a34a",
  "#2563eb",
  "#dc2626",
  "#7c3aed",
  "#ea580c",
  "#0891b2",
  "#0f172a",
  "#db2777",
];

function TrendTooltip({ active, label, payload, propertyLabelMap }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const yearLabel = Number(label);
  if (!Number.isFinite(yearLabel)) return null;
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
          const labelText = propertyLabelMap.get(entry.dataKey) ?? "Property";
          return (
            <div key={entry.dataKey} className="space-y-1">
              <div className="font-medium text-slate-900">{labelText}</div>
              <div className="text-xs text-slate-600">Total: {formatUsd(entry.value)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function IncomeTrendClient({
  categoryOptions,
  propertyOptions,
  selectedCategoryId,
  selectedPropertyId,
  report,
}: IncomeTrendClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [categoryId, setCategoryId] = useState(selectedCategoryId ?? "");
  const [propertyId, setPropertyId] = useState(selectedPropertyId ?? "");
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

  const propertyLabelMap = useMemo(() => {
    return new Map(report.properties.map((p) => [p.id, p.label]));
  }, [report.properties]);

  const sortedProperties = useMemo(() => {
    const props = [...report.properties];
    props.sort((a, b) => a.label.localeCompare(b.label));
    return props;
  }, [report.properties]);

  const isAllProperties = !selectedPropertyId;
  const propertiesForChart = isAllProperties ? sortedProperties : report.properties;

  const colorByPropertyId = useMemo<Record<string, string>>(() => {
    if (!isAllProperties) return {};
    return Object.fromEntries(
      propertiesForChart.map((property, index) => [
        property.id,
        PALETTE[index % PALETTE.length],
      ])
    );
  }, [isAllProperties, propertiesForChart]);

  const handleApply = () => {
    if (!categoryId) return;
    const params = new URLSearchParams();
    params.set("categoryId", categoryId);
    if (propertyId) params.set("propertyId", propertyId);
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
            <label className="ll_label" htmlFor="incomeCategory">
              Income category (required)
            </label>
            {mounted ? (
              <select
                id="incomeCategory"
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
            <label className="ll_label" htmlFor="incomeProperty">
              Property (optional)
            </label>
            {mounted ? (
              <select
                id="incomeProperty"
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
            <h2 className="text-base font-semibold text-slate-900">Income trend by year</h2>
            <p className="ll_muted text-sm">
              Totals combine annual category amounts and ledger transactions.
            </p>
          </div>
        </div>

        {!categoryId ? (
          <p className="ll_muted text-sm">Select a category to see yearly totals.</p>
        ) : report.series.length === 0 || report.properties.length === 0 ? (
          <p className="ll_muted text-sm">No data available for the current filters.</p>
        ) : (
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <ComposedChart
                data={report.series}
                margin={{ top: 10, right: 20, bottom: 10, left: 40 }}
              >
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                <XAxis dataKey="year" tickLine={false} axisLine={false} />
                <YAxis
                  width={90}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatUsd(Number(value))}
                />
                <Tooltip content={<TrendTooltip propertyLabelMap={propertyLabelMap} />} />
                <Legend
                  formatter={(value) => propertyLabelMap.get(String(value)) ?? String(value)}
                />
                {propertiesForChart.map((property) => (
                  <Bar
                    key={`bar-${property.id}`}
                    dataKey={property.id}
                    fill={isAllProperties ? colorByPropertyId[property.id] : "#16a34a"}
                  />
                ))}
                {propertiesForChart.map((property) => (
                  <Line
                    key={`line-${property.id}`}
                    type="monotone"
                    dataKey={property.id}
                    stroke={isAllProperties ? colorByPropertyId[property.id] : "#16a34a"}
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 4 }}
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
