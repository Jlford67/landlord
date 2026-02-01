"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import Button from "@/components/ui/Button";
import { formatUsd } from "@/lib/money";
import type { IncomeVsExpensesRow } from "@/lib/reports/incomeVsExpensesByYear";

type Option = { id: string; label: string };

type IncomeVsExpensesClientProps = {
  propertyOptions: Option[];
  selectedPropertyId?: string;
  report: { rows: IncomeVsExpensesRow[] };
};

type TooltipProps = {
  active?: boolean;
  label?: number | string;
  payload?: Array<{ payload?: IncomeVsExpensesRow }>;
};

const EXPENSE_BASE_COLOR = "#dc2626";
const EXPENSE_OVERAGE_COLOR = "#991b1b";
const INCOME_ABOVE_COLOR = "#16a34a";

function moneyAccounting(amount: number) {
  const abs = Math.abs(amount).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `($${abs})` : `$${abs}`;
}

function amountClass(amount: number) {
  if (amount < 0) return "text-red-600";
  if (amount > 0) return "text-emerald-600";
  return "text-gray-700";
}

function expenseDisplayAmount(expenses: number) {
  return expenses > 0 ? -expenses : expenses;
}

function IncomeVsExpenseTooltip({ active, label, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  if (!row) return null;

  const yearLabel = Number(label);
  const expensesForDisplay = expenseDisplayAmount(row.expenses);

  return (
    <div className="ll_card" style={{ padding: 12, minWidth: 200 }}>
      <div className="text-sm font-semibold text-slate-900">Year {yearLabel}</div>
      <div className="mt-2 space-y-1 text-sm">
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Income</span>
          <span className="font-medium text-emerald-600">
            {moneyAccounting(row.income)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Expenses</span>
          <span className="font-medium text-red-600">
            {moneyAccounting(expensesForDisplay)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="text-slate-600">Net</span>
          <span className={`font-medium ${amountClass(row.net)}`}>
            {moneyAccounting(row.net)}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function IncomeVsExpensesClient({
  propertyOptions,
  selectedPropertyId,
  report,
}: IncomeVsExpensesClientProps) {
  const router = useRouter();
  const pathname = usePathname();

  const [propertyId, setPropertyId] = useState(selectedPropertyId ?? "");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setPropertyId(selectedPropertyId ?? "");
  }, [selectedPropertyId]);

  const chartData = useMemo(() => report.rows, [report.rows]);

  const handleApply = () => {
    const params = new URLSearchParams();
    if (propertyId) params.set("propertyId", propertyId);
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
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
            <label className="ll_label" htmlFor="incomeVsExpenseProperty">
              Property (optional)
            </label>
            {mounted ? (
              <select
                id="incomeVsExpenseProperty"
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
            <Button type="button" variant="warning" size="md" onClick={handleApply}>
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
            <h2 className="text-base font-semibold text-slate-900">
              Income vs expenses by year
            </h2>
            <p className="ll_muted text-sm">
              Totals combine annual category amounts and ledger transactions.
            </p>
          </div>
        </div>

        {chartData.length === 0 ? (
          <p className="ll_muted text-sm">No data available for the current filters.</p>
        ) : (
          <>
            <div style={{ width: "100%", height: 320 }}>
              <ResponsiveContainer>
                <BarChart data={chartData} margin={{ top: 10, right: 20, bottom: 10, left: 40 }}>
                  <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                  <XAxis dataKey="year" tickLine={false} axisLine={false} />
                  <YAxis
                    width={90}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatUsd(Number(value))}
                  />
                  <Tooltip content={<IncomeVsExpenseTooltip />} />
                  <Bar dataKey="expenseBase" stackId="total" fill={EXPENSE_BASE_COLOR} />
                  <Bar dataKey="incomeAbove" stackId="total" fill={INCOME_ABOVE_COLOR} />
                  <Bar
                    dataKey="expenseOverage"
                    stackId="total"
                    fill={EXPENSE_OVERAGE_COLOR}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="ll_table_wrap">
              <table className="ll_table ll_table_zebra w-full table-fixed">
                <colgroup>
                  <col style={{ width: "120px" }} />
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "200px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Year</th>
                    <th className="!text-right">Income</th>
                    <th className="!text-right">Expenses</th>
                    <th className="!text-right">Net</th>
                  </tr>
                </thead>
                <tbody>
                  {chartData.map((row) => (
                    <tr key={row.year}>
                      <td>{row.year}</td>
                      <td className="text-right text-emerald-600">
                        {moneyAccounting(row.income)}
                      </td>
                      <td className="text-right text-red-600">
                        {moneyAccounting(expenseDisplayAmount(row.expenses))}
                      </td>
                      <td className={`text-right ${amountClass(row.net)}`}>
                        {moneyAccounting(row.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-slate-500">
              Expenses shown in accounting format (parentheses).
            </p>
          </>
        )}
      </div>
    </div>
  );
}
