import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildWorkbookBuffer, safeFilenameDateUTC, type ExcelSheet } from "@/lib/export/excel";

export const runtime = "nodejs";

function propertyDisplayName(property: {
  nickname: string | null;
  street: string;
  city: string;
  state: string;
  zip: string;
}) {
  return property.nickname?.trim() || `${property.street}, ${property.city}, ${property.state} ${property.zip}`;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const propertyId = url.searchParams.get("propertyId")?.trim() ?? "";

  const accounts = await prisma.propertyTaxAccount.findMany({
    where:
      q || propertyId
        ? {
            AND: [
              q
                ? {
                    OR: [
                      { name: { contains: q } },
                      { billNumber: { contains: q } },
                      { parcel: { contains: q } },
                      { city: { contains: q } },
                      { state: { contains: q } },
                      {
                        property: {
                          OR: [
                            { nickname: { contains: q } },
                            { street: { contains: q } },
                            { city: { contains: q } },
                            { state: { contains: q } },
                            { zip: { contains: q } },
                          ],
                        },
                      },
                    ],
                  }
                : {},
              propertyId ? { propertyId } : {},
            ],
          }
        : undefined,
    include: {
      property: {
        select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
      },
    },
    orderBy: [{ property: { nickname: "asc" } }, { property: { street: "asc" } }, { dueDate: "desc" }],
  });

  const sheet: ExcelSheet = {
    name: "Property Tax",
    columns: [
      { key: "taxAccountId", header: "Tax Account ID", type: "id", width: 20 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "propertyStreet", header: "Property Street", type: "text", width: 28 },
      { key: "propertyCity", header: "Property City", type: "text", width: 18 },
      { key: "propertyState", header: "Property State", type: "text", width: 10 },
      { key: "propertyZip", header: "Property ZIP", type: "text", width: 12 },
      { key: "authorityName", header: "Billing Authority", type: "text", width: 24 },
      { key: "phone", header: "Phone", type: "text", width: 16 },
      { key: "billNumber", header: "Bill Number", type: "text", width: 16 },
      { key: "parcel", header: "Parcel / APN", type: "text", width: 18 },
      { key: "annualAmount", header: "Annual Amount", type: "currency", width: 16 },
      { key: "dueDate", header: "Due Date", type: "date", width: 12 },
      { key: "lastPaid", header: "Last Paid", type: "date", width: 12 },
      { key: "address1", header: "Billing Address 1", type: "text", width: 28 },
      { key: "address2", header: "Billing Address 2", type: "text", width: 20 },
      { key: "billingCity", header: "Billing City", type: "text", width: 16 },
      { key: "billingState", header: "Billing State", type: "text", width: 10 },
      { key: "billingZip", header: "Billing ZIP", type: "text", width: 12 },
      { key: "web", header: "Web", type: "text", width: 32 },
      { key: "email", header: "Email", type: "text", width: 24 },
    ],
    rows: accounts.map((account) => ({
      taxAccountId: account.id,
      propertyId: account.propertyId,
      propertyName: propertyDisplayName(account.property),
      propertyStreet: account.property.street,
      propertyCity: account.property.city,
      propertyState: account.property.state,
      propertyZip: account.property.zip,
      authorityName: account.name ?? "",
      phone: account.phone ?? "",
      billNumber: account.billNumber ?? "",
      parcel: account.parcel ?? "",
      annualAmount: account.annualAmount ?? null,
      dueDate: account.dueDate ?? null,
      lastPaid: account.lastPaid ?? null,
      address1: account.address1 ?? "",
      address2: account.address2 ?? "",
      billingCity: account.city ?? "",
      billingState: account.state ?? "",
      billingZip: account.zip ?? "",
      web: account.web ?? "",
      email: account.email ?? "",
    })),
  };

  const buffer = buildWorkbookBuffer([sheet]);
  const filename = `property-tax-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
