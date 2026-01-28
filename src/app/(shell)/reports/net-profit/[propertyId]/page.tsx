import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { AmountCell } from "@/components/ui/AmountCell";
import { formatUsd } from "@/lib/money";
import {
  getNetProfitForProperty,
  type NetProfitYears,
} from "@/lib/reports/netProfit";
import YearsSelect from "../YearsSelect";

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

export default async function NetProfitDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ propertyId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const { propertyId } = await params;
  const sp = (await searchParams) ?? {};
  const years = parseYears(getStr(sp, "years"));

  const row = await getNetProfitForProperty({ propertyId, years });

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
                <Link href="/reports/net-profit" className="ll_link">
                  Net Profit Leaderboard
                </Link>
                <span className="ll_muted">/</span>
                <span className="ll_muted">{row.propertyName}</span>
              </div>
              <h1>Net Profit Details</h1>
              <p className="ll_muted break-words">
                Net profit summary for {row.propertyName}.
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
          <div className="ll_card ll_stack" style={{ gap: 8 }}>
            <div className="text-sm font-semibold text-slate-900">Net profit</div>
            <div className="text-2xl font-semibold">
              <AmountCell amount={row.netProfit} className="text-2xl font-semibold" />
            </div>
            <div className="text-xs text-slate-500">
              {formatUsd(row.netProfit)} for the selected period.
            </div>
          </div>
          <div className="ll_card ll_stack" style={{ gap: 6 }}>
            <div className="text-sm font-semibold text-slate-900">Breakdown</div>
            <div className="flex items-center justify-between text-sm">
              <span className="ll_muted">Income</span>
              <AmountCell amount={row.income ?? 0} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="ll_muted">Expenses</span>
              <AmountCell amount={row.expenses ?? 0} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
