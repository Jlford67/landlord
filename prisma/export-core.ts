import { prisma } from "../src/lib/db";
import { promises as fs } from "fs";
import path from "path";

type ScalarValue = string | number | boolean | Date | null;

type ExportSpec = {
  name: string;
  filename: string;
  fields: string[];
  fetch: () => Promise<Record<string, ScalarValue>[]>;
};

const exportSpecs: ExportSpec[] = [
  {
    name: "Category",
    filename: "Category.csv",
    fields: ["id", "type", "name", "active", "parentId"],
    fetch: () => prisma.category.findMany({
      select: { id: true, type: true, name: true, active: true, parentId: true },
      orderBy: [{ type: "asc" }, { name: "asc" }],
    }),
  },
  {
    name: "Property",
    filename: "Property.csv",
    fields: [
      "id",
      "nickname",
      "street",
      "city",
      "state",
      "zip",
      "doors",
      "beds",
      "baths",
      "sqFt",
      "status",
      "purchasePriceCents",
      "purchaseDate",
      "soldPriceCents",
      "soldDate",
      "notes",
      "zillowUrl",
      "redfinUrl",
      "zillowEstimatedValue",
      "zillowEstimatedValueUpdatedAt",
      "redfinEstimatedValue",
      "redfinEstimatedValueUpdatedAt",
      "createdAt",
    ],
    fetch: () => prisma.property.findMany({
      select: {
        id: true,
        nickname: true,
        street: true,
        city: true,
        state: true,
        zip: true,
        doors: true,
        beds: true,
        baths: true,
        sqFt: true,
        status: true,
        purchasePriceCents: true,
        purchaseDate: true,
        soldPriceCents: true,
        soldDate: true,
        notes: true,
        zillowUrl: true,
        redfinUrl: true,
        zillowEstimatedValue: true,
        zillowEstimatedValueUpdatedAt: true,
        redfinEstimatedValue: true,
        redfinEstimatedValueUpdatedAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  },
  {
    name: "Entity",
    filename: "Entity.csv",
    fields: ["id", "name", "type", "notes", "createdAt"],
    fetch: () => prisma.entity.findMany({
      select: { id: true, name: true, type: true, notes: true, createdAt: true },
      orderBy: [{ createdAt: "asc" }],
    }),
  },
  {
    name: "PropertyOwnership",
    filename: "PropertyOwnership.csv",
    fields: ["id", "propertyId", "entityId", "ownershipPct", "startDate", "endDate"],
    fetch: () => prisma.propertyOwnership.findMany({
      select: {
        id: true,
        propertyId: true,
        entityId: true,
        ownershipPct: true,
        startDate: true,
        endDate: true,
      },
      orderBy: [{ propertyId: "asc" }, { entityId: "asc" }],
    }),
  },
  {
    name: "PropertyManagerCompany",
    filename: "PropertyManagerCompany.csv",
    fields: ["id", "name", "phone", "email", "website", "address1", "city", "state", "zip", "notes"],
    fetch: () => prisma.propertyManagerCompany.findMany({
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        website: true,
        address1: true,
        city: true,
        state: true,
        zip: true,
        notes: true,
      },
      orderBy: [{ name: "asc" }],
    }),
  },
  {
    name: "PropertyManagerContact",
    filename: "PropertyManagerContact.csv",
    fields: ["id", "companyId", "name", "phone", "email", "notes"],
    fetch: () => prisma.propertyManagerContact.findMany({
      select: {
        id: true,
        companyId: true,
        name: true,
        phone: true,
        email: true,
        notes: true,
      },
      orderBy: [{ name: "asc" }],
    }),
  },
  {
    name: "PropertyManagerAssignment",
    filename: "PropertyManagerAssignment.csv",
    fields: ["id", "propertyId", "companyId", "contactId", "startDate", "endDate", "notes"],
    fetch: () => prisma.propertyManagerAssignment.findMany({
      select: {
        id: true,
        propertyId: true,
        companyId: true,
        contactId: true,
        startDate: true,
        endDate: true,
        notes: true,
      },
      orderBy: [{ propertyId: "asc" }],
    }),
  },
  {
    name: "Tenant",
    filename: "Tenant.csv",
    fields: ["id", "firstName", "lastName", "email", "phone", "notes", "createdAt"],
    fetch: () => prisma.tenant.findMany({
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  },
  {
    name: "Lease",
    filename: "Lease.csv",
    fields: [
      "id",
      "propertyId",
      "startDate",
      "endDate",
      "rentAmount",
      "dueDay",
      "deposit",
      "unitLabel",
      "status",
      "managedByPm",
      "notes",
      "createdAt",
    ],
    fetch: () => prisma.lease.findMany({
      select: {
        id: true,
        propertyId: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        dueDay: true,
        deposit: true,
        unitLabel: true,
        status: true,
        managedByPm: true,
        notes: true,
        createdAt: true,
      },
      orderBy: [{ startDate: "asc" }],
    }),
  },
  {
    name: "LeaseTenant",
    filename: "LeaseTenant.csv",
    fields: ["id", "leaseId", "tenantId", "role"],
    fetch: () => prisma.leaseTenant.findMany({
      select: { id: true, leaseId: true, tenantId: true, role: true },
      orderBy: [{ leaseId: "asc" }],
    }),
  },
  {
    name: "InsurancePolicy",
    filename: "InsurancePolicy.csv",
    fields: [
      "id",
      "propertyId",
      "insurer",
      "policyNum",
      "agentName",
      "premium",
      "dueDate",
      "paidDate",
      "phone",
      "webPortal",
      "allPolicies",
      "bank",
      "bankNumber",
      "loanRef",
    ],
    fetch: () => prisma.insurancePolicy.findMany({
      select: {
        id: true,
        propertyId: true,
        insurer: true,
        policyNum: true,
        agentName: true,
        premium: true,
        dueDate: true,
        paidDate: true,
        phone: true,
        webPortal: true,
        allPolicies: true,
        bank: true,
        bankNumber: true,
        loanRef: true,
      },
      orderBy: [{ propertyId: "asc" }],
    }),
  },
  {
    name: "PropertyTaxAccount",
    filename: "PropertyTaxAccount.csv",
    fields: [
      "id",
      "propertyId",
      "annualAmount",
      "dueDate",
      "lastPaid",
      "parcel",
      "billNumber",
      "phone",
      "name",
      "address1",
      "address2",
      "city",
      "state",
      "zip",
      "web",
      "email",
    ],
    fetch: () => prisma.propertyTaxAccount.findMany({
      select: {
        id: true,
        propertyId: true,
        annualAmount: true,
        dueDate: true,
        lastPaid: true,
        parcel: true,
        billNumber: true,
        phone: true,
        name: true,
        address1: true,
        address2: true,
        city: true,
        state: true,
        zip: true,
        web: true,
        email: true,
      },
      orderBy: [{ propertyId: "asc" }],
    }),
  },
];

function csvEscape(value: ScalarValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  const str = String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildCsv(fields: string[], rows: Record<string, ScalarValue>[]) {
  const header = fields.join(",");
  const lines = rows.map((row) => fields.map((field) => csvEscape(row[field])).join(","));
  return [header, ...lines].join("\n") + "\n";
}

function timestampLabel(now: Date) {
  return now.toISOString().replace(/[:.]/g, "-");
}

function parseArgs() {
  const args = process.argv.slice(2);
  const outIndex = args.indexOf("--out");
  if (outIndex >= 0 && args[outIndex + 1]) {
    return { out: args[outIndex + 1] };
  }
  return { out: "" };
}

async function main() {
  const { out } = parseArgs();
  const baseDir = out
    ? path.resolve(process.cwd(), out)
    : path.resolve(process.cwd(), "prisma", "exports", timestampLabel(new Date()));

  await fs.mkdir(baseDir, { recursive: true });

  for (const spec of exportSpecs) {
    const rows = await spec.fetch();
    const csv = buildCsv(spec.fields, rows);
    const filePath = path.join(baseDir, spec.filename);
    await fs.writeFile(filePath, csv, "utf8");
    console.log(`${spec.name}: ${rows.length} rows -> ${filePath}`);
  }

  console.log(`Done. Exported ${exportSpecs.length} tables to ${baseDir}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
