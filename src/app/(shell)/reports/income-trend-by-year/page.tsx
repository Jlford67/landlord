import Link from "next/link";
import { prisma } from "@/lib/db";
import { propertyLabel } from "@/lib/format";
import { requireUser } from "@/lib/auth";
import { getIncomeTrendByYear } from "@/lib/reports/incomeTrendByYear";
import IncomeTrendClient from "./IncomeTrendClient";
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

export default async function IncomeTrendByYearPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  await requireUser();

  const sp = (await searchParams) ?? {};
  const categoryId = getStr(sp, "categoryId");
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

  const categories = await prisma.category.findMany({
    where: { type: "income" },
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
    ? await getIncomeTrendByYear({
        categoryId,
        propertyId: propertyId || undefined,
      })
    : { years: [], properties: [], series: [] };

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
                  <span className="ll_muted">Income Trend by Year</span>
                </div>

                <h1>Income Trend by Year</h1>

                <p className="ll_muted break-words">
                  Compare annual income across properties with annual totals and ledger
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

              <form action="/api/exports/reports/income-trend-by-year" method="get">
                <input type="hidden" name="categoryId" value={categoryId} />
                {propertyId ? (
                  <input type="hidden" name="propertyId" value={propertyId} />
                ) : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  leftIcon={<Download className="h-4 w-4" />}
                  disabled={!categoryId}
                >
                  Export Excel
                </Button>
              </form>
            </div>
          </div>
        </div>

        {!categoryId ? (
          <div className="ll_card">
            <p className="ll_muted">
              Select an income category to view yearly trends across your properties.
            </p>
          </div>
        ) : null}

        <IncomeTrendClient
          categoryOptions={categoryOptions}
          propertyOptions={propertyOptions}
          selectedCategoryId={categoryId || undefined}
          selectedPropertyId={propertyId || undefined}
          report={report}
        />
      </div>
    </div>
  );
}
