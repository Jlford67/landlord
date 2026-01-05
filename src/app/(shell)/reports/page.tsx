import Link from "next/link";
import { requireUser } from "@/lib/auth";

export default async function ReportsIndexPage() {
  await requireUser();

  return (
    <div className="ll_page">
      <div className="ll_panel">
        <div className="ll_rowBetween">
          <div>
            <h1>Reports</h1>
            <div className="ll_muted">Analyze your portfolio performance.</div>
          </div>
        </div>

        <div className="mt-4 ll_panelInner">
          <h2 style={{ marginBottom: 10 }}>Available reports</h2>
          <ul className="list-disc pl-5 text-sm text-slate-800">
            <li>
              <Link className="ll_link" href="/reports/profit-loss">
                Profit &amp; Loss by Property (Date Range)
              </Link>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
