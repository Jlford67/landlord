import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getExpenseTrendByYear } from "@/lib/reports/expenseTrendByYear";
import ExpenseTrendClient from "./ExpenseTrendClient";
import LinkButton from "@/components/ui/LinkButton";
import { ArrowLeft } from "lucide-react";

type SearchParams = Record<string, string | string[] | undefined>;

function getStr(sp: SearchParams, key: string): string {
  const v = sp[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? "";
  return "";
}

export default async function ExpenseTrendByYearPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};
  const categoryId = getStr(sp, "categoryId");
  const propertyId = getStr(sp, "propertyId");
  const positiveParam = getStr(sp, "positive");
  const showPositive = positiveParam !== "0";

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

  const categories = await prisma.category.findMany({
    where: { type: "expense" },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
    },
  });

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    label: category.name,
  }));

  const report = categoryId
    ? await getExpenseTrendByYear({
        categoryId,
        propertyId: propertyId || undefined,
      })
    : { years: [], properties: [], seriesRaw: [], seriesDisplay: [] };

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
                  <span className="ll_muted">Expense Trend by Year</span>
                </div>

                <h1>Expense Trend by Year</h1>

                <p className="ll_muted break-words">
                  Compare annual expenses across properties with annual totals and ledger
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
            </div>
          </div>
        </div>

        {!categoryId ? (
          <div className="ll_card">
            <p className="ll_muted">
              Select an expense category to view yearly trends across your properties.
            </p>
          </div>
        ) : null}

        <ExpenseTrendClient
          categoryOptions={categoryOptions}
          propertyOptions={propertyOptions}
          selectedCategoryId={categoryId || undefined}
          selectedPropertyId={propertyId || undefined}
          showPositive={showPositive}
          report={report}
        />
      </div>
    </div>
  );
}
