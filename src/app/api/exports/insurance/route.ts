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

  const policies = await prisma.insurancePolicy.findMany({
    where:
      q || propertyId
        ? {
            AND: [
              q
                ? {
                    OR: [
                      { insurer: { contains: q } },
                      { policyNum: { contains: q } },
                      { agentName: { contains: q } },
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
    name: "Insurance",
    columns: [
      { key: "policyId", header: "Policy ID", type: "id", width: 20 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 32 },
      { key: "propertyStreet", header: "Property Street", type: "text", width: 28 },
      { key: "propertyCity", header: "Property City", type: "text", width: 18 },
      { key: "propertyState", header: "Property State", type: "text", width: 10 },
      { key: "propertyZip", header: "Property ZIP", type: "text", width: 12 },
      { key: "insurer", header: "Carrier", type: "text", width: 20 },
      { key: "policyNumber", header: "Policy Number", type: "text", width: 18 },
      { key: "agentName", header: "Agent Name", type: "text", width: 18 },
      { key: "premium", header: "Premium", type: "currency", width: 14 },
      { key: "dueDate", header: "Due Date", type: "date", width: 12 },
      { key: "paidDate", header: "Paid Date", type: "date", width: 12 },
      { key: "phone", header: "Phone", type: "text", width: 16 },
      { key: "webPortal", header: "Web Portal", type: "text", width: 32 },
      { key: "allPolicies", header: "Policy Details", type: "notes", width: 50 },
      { key: "bank", header: "Bank", type: "text", width: 18 },
      { key: "bankNumber", header: "Bank Number", type: "text", width: 18 },
      { key: "loanRef", header: "Loan Reference", type: "text", width: 18 },
    ],
    rows: policies.map((policy) => ({
      policyId: policy.id,
      propertyId: policy.propertyId,
      propertyName: propertyDisplayName(policy.property),
      propertyStreet: policy.property.street,
      propertyCity: policy.property.city,
      propertyState: policy.property.state,
      propertyZip: policy.property.zip,
      insurer: policy.insurer ?? "",
      policyNumber: policy.policyNum ?? "",
      agentName: policy.agentName ?? "",
      premium: policy.premium ?? null,
      dueDate: policy.dueDate ?? null,
      paidDate: policy.paidDate ?? null,
      phone: policy.phone ?? "",
      webPortal: policy.webPortal ?? "",
      allPolicies: policy.allPolicies ?? "",
      bank: policy.bank ?? "",
      bankNumber: policy.bankNumber ?? "",
      loanRef: policy.loanRef ?? "",
    })),
  };

  const buffer = buildWorkbookBuffer([sheet]);
  const filename = `insurance-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
