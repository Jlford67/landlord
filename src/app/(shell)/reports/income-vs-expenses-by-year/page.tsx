import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getIncomeVsExpensesByYear } from "@/lib/reports/incomeVsExpensesByYear";
import IncomeVsExpensesClient from "./IncomeVsExpensesClient";
import LinkButton from "@/components/ui/LinkButton";
import Button from "@/components/ui/Button";
import { ArrowLeft, Download } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function IncomeVsExpensesByYearPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};
  const propertyId = getStr(sp, "propertyId");

  const properties = await prisma.property.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      nickname: true,
      street: true,
      city: true,
      state: true,
      zip: true,
    },
  });

  const propertyOptions = properties.map((p) => ({
    id: p.id,
    label: propertyLabel(p),
  }));

  const report = await getIncomeVsExpensesByYear({
    propertyId: propertyId || undefined,
  });

  return (
    <div className="ll_page">
      <div className="ll_panel ll_stack" style={{ gap: 24 }}>
        <div className="ll_card" style={{ marginBottom: 14 }}>
          <div className="ll_topbar" style={{ marginBottom: 0 }}>
            <div className="ll_rowBetween items-start gap-3">
              <div className="ll_stack min-w-0 flex-1" style={{ gap: 4 }}>
                <div className="ll_breadcrumbs">
                  <Link href="/reports" className="ll_link">
                    Reports
                  </Link>
                  <span className="ll_muted">/</span>
                  <span className="ll_muted">Income vs Expenses by Year</span>
                </div>

                <h1>Income vs Expenses by Year</h1>

                <p className="ll_muted break-words">
                  Compare yearly income and expenses with annual totals and ledger
                  transactions combined.
                </p>
              </div>
            </div>

            <div className="ll_topbarRight flex flex-wrap items-center gap-2 shrink-0 justify-end">
              <LinkButton
                href="/reports"
                variant="outline"
                size="md"
                leftIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </LinkButton>

              <form action="/api/exports/reports/income-vs-expenses-by-year" method="get">
                {propertyId ? (
                  <input type="hidden" name="propertyId" value={propertyId} />
                ) : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  leftIcon={<Download className="h-4 w-4" />}
                >
                  Export Excel
                </Button>
              </form>
            </div>
          </div>
        </div>

        <IncomeVsExpensesClient
          propertyOptions={propertyOptions}
          selectedPropertyId={propertyId || undefined}
          report={report}
        />
      </div>
    </div>
  );
}
