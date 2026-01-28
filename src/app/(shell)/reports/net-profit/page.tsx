import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { formatUsd } from "@/lib/money";
import { AmountCell } from "@/components/ui/AmountCell";
import {
  getNetProfitByProperty,
  type NetProfitYears,
} from "@/lib/reports/netProfit";
import YearsSelect from "./YearsSelect";
import NetProfitLeaderboardClient from "./NetProfitLeaderboardClient";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

function parseYears(value?: string): NetProfitYears {
  const allowed: NetProfitYears[] = ["1", "3", "5", "10", "15", "all"];
  if (value && allowed.includes(value as NetProfitYears)) {
    return value as NetProfitYears;
  }
  return "5";
}

export default async function NetProfitPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};
  const years = parseYears(getStr(sp, "years"));

  const rows = await getNetProfitByProperty({ years });
  const grandTotal = rows.reduce((sum, row) => sum + row.netProfit, 0);

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 20 }}>
        <div className="ll_card">
          <div className="ll_topbar">
            <div className="min-w-0">
              <div className="ll_breadcrumbs">
                <Link href="/reports" className="ll_link">
                  Reports
                </Link>
                <span className="ll_muted">/</span>
                <span className="ll_muted">Net Profit Leaderboard</span>
              </div>
              <h1>Net Profit Leaderboard</h1>
              <p className="ll_muted break-words">
                Rank properties by net profit over the selected period.
              </p>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div className="ll_card">
            <YearsSelect value={years} />
          </div>
          <div className="ll_card ll_stack" style={{ gap: 6 }}>
            <div className="text-sm font-semibold text-slate-900">Grand total net profit</div>
            <div className="text-2xl font-semibold">
              <AmountCell amount={grandTotal} className="text-2xl font-semibold" />
            </div>
            <div className="text-xs text-slate-500">
              {formatUsd(grandTotal)} across all properties.
            </div>
          </div>
        </div>

        <NetProfitLeaderboardClient rows={rows} years={years} />
      </div>
    </div>
  );
}
