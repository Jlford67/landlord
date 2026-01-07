import Link from "next/link";
import { requireUser } from "@/lib/auth";

type ReportItem = {
  title: string;
  description: string;
  href?: string;
  badgeText: string;
};

type ReportSection = {
  title: string;
  items: ReportItem[];
};

const sections: ReportSection[] = [
  {
    title: "Profit & Loss",
    items: [
      {
        title: "Profit & Loss by Property (Date Range)",
        description: "Income and expenses by category, with property and grand totals.",
        href: "/reports/profit-loss",
        badgeText: "Date range",
      },
      {
        title: "Profit & Loss by Month (Trend)",
        description: "Monthly income, expenses, and net over time.",
        href: "/reports/profit-loss-by-month",
        badgeText: "Monthly",
      },
      {
        title: "Annual Profit & Loss Summary",
        description: "Tax-facing year rollup across ledger and annual totals.",
        href: "/reports/annual-profit-and-loss-summary",
        badgeText: "Annual",
      },
      {
        title: "Cash vs Accrual P&L",
        description: "Compare cash-based and accrual-based performance.",
        href: "/reports/cash-vs-accrual-pl",
        badgeText: "Date range",
      },
    ],
  },
  {
    title: "Income",
    items: [
      {
        title: "Rental Income by Property",
        description: "Lease and rent collections across properties.",
        href: "/reports/rental-income-by-property",
        badgeText: "Date range",
      },
      {
        title: "Income by Category",
        description: "Breakdown of income categories across the portfolio.",
        href: "/reports/income-by-category",
        badgeText: "Date range",
      },
    ],
  },
  {
    title: "Expenses",
    items: [
      {
        title: "Expenses by Category",
        description: "Spending by expense category with totals.",
        href: "/reports/expenses-by-category",
        badgeText: "Date range",
      },
      {
        title: "Expenses by Property",
        description: "Compare total expenses across properties, including prorated annual items",
        href: "/reports/expenses-by-property",
        badgeText: "Date range",
      },
      {
        title: "Recurring Expenses Overview",
        description: "Upcoming and historical recurring spend.",
        href: "/reports/recurring-expenses-overview",
        badgeText: "Date range",
      },
    ],
  },
  {
    title: "Tax & Year-End",
    items: [
      {
        title: "Schedule E Summary",
        description: "Export-friendly rollup for year-end filing.",
        href: "/reports/schedule-e-summary",
        badgeText: "Tax",
      },
    ],
  },
  {
    title: "Portfolio",
    items: [
      {
        title: "Portfolio Leaderboard",
        description: "Rank properties by cash flow, appreciation, or total return.",
        href: "/reports/portfolio-leaderboard",
        badgeText: "Leaderboard",
      },
    ],
  },
];

function ReportRow({ item, hasDivider }: { item: ReportItem; hasDivider: boolean }) {
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="font-medium text-sm sm:text-base">{item.title}</div>
        <p className="ll_muted text-sm leading-5">{item.description}</p>
      </div>
      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 whitespace-nowrap">
        {item.href ? item.badgeText : "Coming soon"}
      </span>
    </div>
  );

  const baseClasses = [
    "p-4",
    hasDivider ? "border-t border-slate-100" : "",
    item.href
      ? "hover:bg-gray-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 rounded-md transition-colors"
      : "opacity-60 cursor-not-allowed",
  ]
    .filter(Boolean)
    .join(" ");

  if (item.href) {
    return (
      <Link href={item.href} className={baseClasses}>
        {content}
      </Link>
    );
  }

  return <div className={baseClasses}>{content}</div>;
}

export default async function ReportsIndexPage() {
  await requireUser();

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        <div className="ll_rowBetween items-start gap-3">
          <div className="ll_stack" style={{ gap: 4 }}>
            <h1>Reports</h1>
            <p className="ll_muted">Portfolio reporting and exports.</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" className="ll_btn ll_btnSecondary" disabled>
              Export all
            </button>
            <button type="button" className="ll_btn ll_btnSecondary" disabled>
              Help
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {sections
            .filter((section) => section.items.length > 0)
            .map((section) => (
              <div key={section.title} className="ll_card ll_stack" style={{ gap: 4 }}>
                <h2 className="text-sm font-semibold text-slate-900">{section.title}</h2>
                <div className="mt-1">
                  {section.items.map((item, idx) => (
                    <ReportRow key={item.title} item={item} hasDivider={idx > 0} />
                  ))}
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
