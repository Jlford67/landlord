import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import PropertyHeader from "@/components/properties/PropertyHeader";
import RowActions from "@/components/ui/RowActions";

interface PageProps {
  params: { propertyId?: string; id?: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function PropertyRecurringPage({ params, searchParams }: PageProps) {
  await requireUser();

  const propertyId =
    params.propertyId ??
    params.id ??
    (typeof searchParams?.propertyId === "string" ? searchParams.propertyId : undefined);

  if (!propertyId) notFound();

  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    include: {
      recurringItems: {
        where: { deletedAt: null },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!property) notFound();

  return (
    <div className="space-y-6">
      <PropertyHeader property={property} />

      <div className="card">
        <div className="card_header flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recurring items</h2>

          <Link
            href={`/recurring/new?propertyId=${property.id}`}
            className="ll_btn ll_btn_primary"
          >
            Add recurring item
          </Link>
        </div>

        {property.recurringItems.length === 0 ? (
          <div className="card_body ll_muted">No recurring items for this property.</div>
        ) : (
          <div className="card_body overflow-x-auto">
            <table className="ll_table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Amount</th>
                  <th>Frequency</th>
                  <th>Next post</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {property.recurringItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>
                      ${(item.amountCents / 100).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </td>
                    <td>{item.frequency}</td>
                    <td>{item.nextPostDate ? item.nextPostDate.toISOString().slice(0, 10) : "—"}</td>
                    <td className="text-right">
                      <RowActions editHref={`/recurring/${item.id}/edit`} ariaLabelEdit={`Edit ${item.name}`} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
