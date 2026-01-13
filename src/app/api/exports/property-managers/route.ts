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

  const companies = await prisma.propertyManagerCompany.findMany({
    where:
      q || propertyId
        ? {
            AND: [
              q
                ? {
                    OR: [
                      { name: { contains: q } },
                      { phone: { contains: q } },
                      { email: { contains: q } },
                      { website: { contains: q } },
                      {
                        contacts: {
                          some: {
                            OR: [
                              { name: { contains: q } },
                              { email: { contains: q } },
                              { phone: { contains: q } },
                            ],
                          },
                        },
                      },
                      {
                        assignments: {
                          some: {
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
                        },
                      },
                    ],
                  }
                : {},
              propertyId
                ? {
                    assignments: {
                      some: { propertyId },
                    },
                  }
                : {},
            ],
          }
        : undefined,
    include: {
      contacts: {
        select: {
          id: true,
          name: true,
          phone: true,
          email: true,
          notes: true,
        },
        orderBy: [{ name: "asc" }],
      },
      assignments: {
        select: {
          id: true,
          propertyId: true,
          contactId: true,
          startDate: true,
          endDate: true,
          notes: true,
          property: {
            select: { id: true, nickname: true, street: true, city: true, state: true, zip: true },
          },
          contact: {
            select: { id: true, name: true, phone: true, email: true },
          },
        },
        orderBy: [{ startDate: "desc" }],
      },
    },
    orderBy: [{ name: "asc" }],
  });

  const companySheet: ExcelSheet = {
    name: "Property Managers",
    columns: [
      { key: "companyId", header: "Company ID", type: "id", width: 20 },
      { key: "companyName", header: "Company Name", type: "text", width: 26 },
      { key: "phone", header: "Phone", type: "text", width: 16 },
      { key: "email", header: "Email", type: "text", width: 24 },
      { key: "website", header: "Website", type: "text", width: 28 },
      { key: "address1", header: "Address 1", type: "text", width: 24 },
      { key: "city", header: "City", type: "text", width: 16 },
      { key: "state", header: "State", type: "text", width: 10 },
      { key: "zip", header: "ZIP", type: "text", width: 12 },
      { key: "notes", header: "Notes", type: "notes", width: 50 },
    ],
    rows: companies.map((company) => ({
      companyId: company.id,
      companyName: company.name,
      phone: company.phone ?? "",
      email: company.email ?? "",
      website: company.website ?? "",
      address1: company.address1 ?? "",
      city: company.city ?? "",
      state: company.state ?? "",
      zip: company.zip ?? "",
      notes: company.notes ?? "",
    })),
  };

  const contactsSheet: ExcelSheet = {
    name: "Contacts",
    columns: [
      { key: "contactId", header: "Contact ID", type: "id", width: 20 },
      { key: "companyId", header: "Company ID", type: "id", width: 20 },
      { key: "companyName", header: "Company Name", type: "text", width: 26 },
      { key: "contactName", header: "Contact Name", type: "text", width: 20 },
      { key: "phone", header: "Phone", type: "text", width: 16 },
      { key: "email", header: "Email", type: "text", width: 24 },
      { key: "notes", header: "Notes", type: "notes", width: 50 },
    ],
    rows: companies.flatMap((company) =>
      company.contacts.map((contact) => ({
        contactId: contact.id,
        companyId: company.id,
        companyName: company.name,
        contactName: contact.name,
        phone: contact.phone ?? "",
        email: contact.email ?? "",
        notes: contact.notes ?? "",
      })),
    ),
  };

  const assignmentsSheet: ExcelSheet = {
    name: "Assignments",
    columns: [
      { key: "assignmentId", header: "Assignment ID", type: "id", width: 20 },
      { key: "companyId", header: "Company ID", type: "id", width: 20 },
      { key: "companyName", header: "Company Name", type: "text", width: 26 },
      { key: "propertyId", header: "Property ID", type: "id", width: 20 },
      { key: "propertyName", header: "Property Name", type: "text", width: 30 },
      { key: "propertyStreet", header: "Property Street", type: "text", width: 28 },
      { key: "propertyCity", header: "Property City", type: "text", width: 18 },
      { key: "propertyState", header: "Property State", type: "text", width: 10 },
      { key: "propertyZip", header: "Property ZIP", type: "text", width: 12 },
      { key: "contactId", header: "Contact ID", type: "id", width: 20 },
      { key: "contactName", header: "Contact Name", type: "text", width: 20 },
      { key: "contactPhone", header: "Contact Phone", type: "text", width: 16 },
      { key: "contactEmail", header: "Contact Email", type: "text", width: 24 },
      { key: "startDate", header: "Start Date", type: "date", width: 12 },
      { key: "endDate", header: "End Date", type: "date", width: 12 },
      { key: "notes", header: "Notes", type: "notes", width: 50 },
    ],
    rows: companies.flatMap((company) =>
      company.assignments
        .filter(
          (assignment) =>
            !propertyId || assignment.propertyId === propertyId
        )
        .map((assignment) => ({
          assignmentId: assignment.id,
          companyId: company.id,
          companyName: company.name,
          propertyId: assignment.propertyId,
          propertyName: propertyDisplayName(assignment.property),
          propertyStreet: assignment.property.street,
          propertyCity: assignment.property.city,
          propertyState: assignment.property.state,
          propertyZip: assignment.property.zip,
          contactId: assignment.contact?.id ?? "",
          contactName: assignment.contact?.name ?? "",
          contactPhone: assignment.contact?.phone ?? "",
          contactEmail: assignment.contact?.email ?? "",
          startDate: assignment.startDate ?? null,
          endDate: assignment.endDate ?? null,
          notes: assignment.notes ?? "",
        }))
    ),

    ),
  };

  const buffer = buildWorkbookBuffer([companySheet, contactsSheet, assignmentsSheet]);
  const filename = `property-managers-${safeFilenameDateUTC()}.xlsx`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
    },
  });
}
