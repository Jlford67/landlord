import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function ReportsIndexPage() {
  await requireUser();

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 20 }}>
        <header className="ll_stack" style={{ gap: 4 }}>
          <h1>Reports</h1>
          <p className="ll_muted">Portfolio reporting and exports.</p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/reports/profit-loss" className="ll_card focus:outline-none focus:ring-2 focus:ring-indigo-500">
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="ll_rowBetween">
                <h2 className="text-base font-semibold">Profit &amp; Loss by Property (Date Range)</h2>
                <span className="text-sm ll_muted">Open →</span>
              </div>
              <p className="text-sm text-slate-800">
                Income and expenses by category, with property and grand totals.
              </p>
              <p className="text-xs ll_muted">Date range</p>
            </div>
          </Link>

          <Link
            href="/reports/profit-loss-by-month"
            className="ll_card focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <div className="ll_stack" style={{ gap: 6 }}>
              <div className="ll_rowBetween">
                <h2 className="text-base font-semibold">Profit &amp; Loss by Month (Trend)</h2>
                <span className="text-sm ll_muted">Open →</span>
              </div>
              <p className="text-sm text-slate-800">
                Monthly income, expenses, and net over time.
              </p>
              <p className="text-xs ll_muted">Monthly trend</p>
            </div>
          </Link>
        </div>

        <div className="ll_card">
          <div className="ll_stack" style={{ gap: 8 }}>
            <h2 className="text-sm font-semibold">Tips</h2>
            <ul className="list-disc pl-5 text-sm text-slate-800">
              <li>Use Include annual totals for taxes/insurance.</li>
              <li>Exclude transfers for cleaner NOI.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
