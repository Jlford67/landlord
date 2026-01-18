"use client";

import { useEffect, useState, useTransition } from "react";
import { AmountCell } from "@/components/ui/AmountCell";

type YearRowDisplay = {
  year: number;
  incomeLabel: string;
  expensesLabel: string;
  netLabel: string;
  incomeClass: string;
  expensesClass: string;
  netClass: string;
};

type YearTotalsDisplay = {
  incomeLabel: string;
  expensesLabel: string;
  netLabel: string;
  incomeClass: string;
  expensesClass: string;
  netClass: string;
};

type DrilldownRow = {
  id: string;
  dateIso: string;
  description: string;
  categoryName: string;
  amount: number;
};

type DrilldownResult = {
  rows: DrilldownRow[];
  total: number;
};

type DrilldownParams = {
  propertyId: string | null;
  year: number;
  kind: "income" | "expense";
};

type YearlySummaryClientProps = {
  rows: YearRowDisplay[];
  totals: YearTotalsDisplay;
  propertyId: string | null;
  getYearDrilldown: (params: DrilldownParams) => Promise<DrilldownResult>;
};

function formatDate(dateIso: string) {
  const d = new Date(dateIso);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

function formatMoney(amount: number) {
  const abs = Math.abs(amount).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return amount < 0 ? `($${abs})` : `$${abs}`;
}

export default function YearlySummaryClient({
  rows,
  totals,
  propertyId,
  getYearDrilldown,
}: YearlySummaryClientProps) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<{ year: number; kind: "income" | "expense" } | null>(
    null,
  );
  const [drilldown, setDrilldown] = useState<{
    title: string;
    rows: DrilldownRow[];
    total: number;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSelect = (year: number, kind: "income" | "expense") => {
    if (!mounted) return;
    setSelected({ year, kind });
    startTransition(async () => {
      const result = await getYearDrilldown({ propertyId, year, kind });
      setDrilldown({
        title: `${year} ${kind === "income" ? "Income" : "Expense"} details`,
        rows: result.rows,
        total: result.total,
      });
    });
  };

  const clearDrilldown = () => {
    setSelected(null);
    setDrilldown(null);
  };

  return (
    <div>
      <section className="ll_card ll_dash_tableCard">
        <div className="ll_dash_tableWrap">
          <table className="ll_table w-full table-fixed">
            <thead>
              <tr>
                <th style={{ width: 120 }} className="text-left !text-left">
                  Year
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Income
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Expenses
                </th>
                <th style={{ width: 180 }} className="text-right !text-right">
                  Net Profit
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-3 text-gray-500">
                    No data yet
                  </td>
                </tr>
              ) : (
                <>
                  {rows.map((row) => {
                    const isIncomeSelected =
                      selected?.year === row.year && selected?.kind === "income";
                    const isExpenseSelected =
                      selected?.year === row.year && selected?.kind === "expense";

                    return (
                      <tr key={row.year}>
                        <td className="font-medium">{row.year}</td>
                        <td className={`text-right ${row.incomeClass}`}>
                          {mounted ? (
                            <button
                              type="button"
                              onClick={() => handleSelect(row.year, "income")}
                              className={`inline-flex items-center justify-end gap-1 text-right hover:underline ${
                                isIncomeSelected ? "rounded bg-blue-50 px-1" : ""
                              }`}
                            >
                              {row.incomeLabel}
                            </button>
                          ) : (
                            row.incomeLabel
                          )}
                        </td>
                        <td className={`text-right ${row.expensesClass}`}>
                          {mounted ? (
                            <button
                              type="button"
                              onClick={() => handleSelect(row.year, "expense")}
                              className={`inline-flex items-center justify-end gap-1 text-right hover:underline ${
                                isExpenseSelected ? "rounded bg-blue-50 px-1" : ""
                              }`}
                            >
                              {row.expensesLabel}
                            </button>
                          ) : (
                            row.expensesLabel
                          )}
                        </td>
                        <td className={`text-right font-medium ${row.netClass}`}>
                          {row.netLabel}
                        </td>
                      </tr>
                    );
                  })}

                  <tr className="border-t border-gray-200">
                    <td className="font-semibold">Total</td>
                    <td className={`text-right font-semibold ${totals.incomeClass}`}>
                      {totals.incomeLabel}
                    </td>
                    <td className={`text-right font-semibold ${totals.expensesClass}`}>
                      {totals.expensesLabel}
                    </td>
                    <td className={`text-right font-semibold ${totals.netClass}`}>
                      {totals.netLabel}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {drilldown && (
        <section className="ll_card ll_dash_tableCard mt-4">
          <div className="ll_dash_tableWrap">
            <div className="flex items-center justify-between px-4 pb-2 pt-4">
              <div className="text-sm font-semibold text-gray-900">{drilldown.title}</div>
              {mounted ? (
                <button type="button" className="ll_dash_link" onClick={clearDrilldown}>
                  Clear
                </button>
              ) : null}
            </div>
            <table className="ll_table w-full table-fixed">
              <thead>
                <tr>
                  <th style={{ width: 140 }} className="text-left !text-left">
                    Date
                  </th>
                  <th className="text-left !text-left">Payee/Description</th>
                  <th style={{ width: 200 }} className="text-left !text-left">
                    Category
                  </th>
                  <th style={{ width: 160 }} className="text-right !text-right">
                    Amount
                  </th>
                </tr>
              </thead>
              <tbody>
                {drilldown.rows.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-gray-500">
                      No transactions found.
                    </td>
                  </tr>
                ) : (
                  <>
                    {drilldown.rows.map((row) => (
                      <tr key={row.id}>
                        <td>{formatDate(row.dateIso)}</td>
                        <td>{row.description}</td>
                        <td>{row.categoryName}</td>
                        <td className="text-right">
                          <AmountCell amount={row.amount} />
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-gray-200">
                      <td className="font-semibold" colSpan={3}>
                        Total
                      </td>
                      <td className="text-right font-semibold">
                        <AmountCell amount={drilldown.total} />
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
            {isPending ? (
              <div className="px-4 pb-4 text-xs text-gray-500">Loading…</div>
            ) : null}
          </div>
        </section>
      )}
    </div>
  );
}
