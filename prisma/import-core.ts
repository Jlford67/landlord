import { prisma } from "../src/lib/db";
import { promises as fs } from "fs";
import path from "path";

type ScalarValue = string | number | boolean | Date | null;

type ImportSpec = {
  name: string;
  filename: string;
  fields: string[];
  required: boolean;
  parseRow: (row: Record<string, string>) => Record<string, ScalarValue>;
  upsert: (data: Record<string, ScalarValue>[]) => Promise<number>;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const inIndex = args.indexOf("--in");
  if (inIndex >= 0 && args[inIndex + 1]) {
    return { input: args[inIndex + 1] };
  }
  return { input: "" };
}

function parseCsv(content: string): Record<string, string>[] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    current.push(field);
    field = "";
  };

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const next = content[i + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        field += "\"";
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      pushField();
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i++;
      pushField();
      rows.push(current);
      current = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || current.length > 0) {
    pushField();
    rows.push(current);
  }

  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);

  return dataRows
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) => {
      const record: Record<string, string> = {};
      header.forEach((key, idx) => {
        record[key] = row[idx] ?? "";
      });
      return record;
    });
}

function parseBoolean(value: string) {
  if (value === "") return null;
  return value.toLowerCase() === "true";
}

function parseNumber(value: string) {
  if (value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function parseDate(value: string) {
  if (value === "") return null;
  return new Date(value);
}

function parseString(value: string) {
  return value === "" ? null : value;
}

async function readCsvRecords(folder: string, filename: string): Promise<Record<string, string>[]> {
  const filePath = path.join(folder, filename);
  const content = await fs.readFile(filePath, "utf8");
  return parseCsv(content);
}

const importSpecs: ImportSpec[] = [
  {
    name: "Entity",
    filename: "Entity.csv",
    fields: ["id", "name", "type", "notes", "createdAt"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      name: row.name,
      type: row.type,
      notes: parseString(row.notes),
      createdAt: parseDate(row.createdAt) ?? new Date(),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.entity.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "Category",
    filename: "Category.csv",
    fields: ["id", "type", "name", "active", "parentId"],
    required: true,
    parseRow: (row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      active: row.active === "" ? true : row.active.toLowerCase() === "true",
      parentId: parseString(row.parentId),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        const entityCount = await tx.entity.count();
        if (entityCount === 0) {
          throw new Error("Entity must be imported before Category to satisfy foreign keys.");
        }
        let count = 0;
        for (const data of rows) {
          await tx.category.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
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
    required: true,
    parseRow: (row) => ({
      id: row.id,
      nickname: parseString(row.nickname),
      street: row.street,
      city: row.city,
      state: row.state,
      zip: row.zip,
      doors: parseNumber(row.doors),
      beds: parseNumber(row.beds),
      baths: parseNumber(row.baths),
      sqFt: parseNumber(row.sqFt),
      status: row.status || "active",
      purchasePriceCents: parseNumber(row.purchasePriceCents),
      purchaseDate: parseDate(row.purchaseDate),
      soldPriceCents: parseNumber(row.soldPriceCents),
      soldDate: parseDate(row.soldDate),
      notes: parseString(row.notes),
      zillowUrl: parseString(row.zillowUrl),
      redfinUrl: parseString(row.redfinUrl),
      zillowEstimatedValue: parseNumber(row.zillowEstimatedValue),
      zillowEstimatedValueUpdatedAt: parseDate(row.zillowEstimatedValueUpdatedAt),
      redfinEstimatedValue: parseNumber(row.redfinEstimatedValue),
      redfinEstimatedValueUpdatedAt: parseDate(row.redfinEstimatedValueUpdatedAt),
      createdAt: parseDate(row.createdAt) ?? new Date(),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.property.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "PropertyOwnership",
    filename: "PropertyOwnership.csv",
    fields: ["id", "propertyId", "entityId", "ownershipPct", "startDate", "endDate"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      propertyId: row.propertyId,
      entityId: row.entityId,
      ownershipPct: parseNumber(row.ownershipPct) ?? 100,
      startDate: parseDate(row.startDate),
      endDate: parseDate(row.endDate),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.propertyOwnership.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "PropertyManagerCompany",
    filename: "PropertyManagerCompany.csv",
    fields: ["id", "name", "phone", "email", "website", "address1", "city", "state", "zip", "notes"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      name: row.name,
      phone: parseString(row.phone),
      email: parseString(row.email),
      website: parseString(row.website),
      address1: parseString(row.address1),
      city: parseString(row.city),
      state: parseString(row.state),
      zip: parseString(row.zip),
      notes: parseString(row.notes),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.propertyManagerCompany.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "PropertyManagerContact",
    filename: "PropertyManagerContact.csv",
    fields: ["id", "companyId", "name", "phone", "email", "notes"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      companyId: row.companyId,
      name: row.name,
      phone: parseString(row.phone),
      email: parseString(row.email),
      notes: parseString(row.notes),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.propertyManagerContact.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "PropertyManagerAssignment",
    filename: "PropertyManagerAssignment.csv",
    fields: ["id", "propertyId", "companyId", "contactId", "startDate", "endDate", "notes"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      propertyId: row.propertyId,
      companyId: row.companyId,
      contactId: parseString(row.contactId),
      startDate: parseDate(row.startDate),
      endDate: parseDate(row.endDate),
      notes: parseString(row.notes),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.propertyManagerAssignment.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "Tenant",
    filename: "Tenant.csv",
    fields: ["id", "firstName", "lastName", "email", "phone", "notes", "createdAt"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      firstName: row.firstName,
      lastName: row.lastName,
      email: parseString(row.email),
      phone: parseString(row.phone),
      notes: parseString(row.notes),
      createdAt: parseDate(row.createdAt) ?? new Date(),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.tenant.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
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
    required: false,
    parseRow: (row) => ({
      id: row.id,
      propertyId: row.propertyId,
      startDate: parseDate(row.startDate) ?? new Date(),
      endDate: parseDate(row.endDate),
      rentAmount: parseNumber(row.rentAmount) ?? 0,
      dueDay: parseNumber(row.dueDay) ?? 1,
      deposit: parseNumber(row.deposit),
      unitLabel: parseString(row.unitLabel),
      status: row.status || "active",
      managedByPm: row.managedByPm === "" ? true : row.managedByPm.toLowerCase() === "true",
      notes: parseString(row.notes),
      createdAt: parseDate(row.createdAt) ?? new Date(),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.lease.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
  {
    name: "LeaseTenant",
    filename: "LeaseTenant.csv",
    fields: ["id", "leaseId", "tenantId", "role"],
    required: false,
    parseRow: (row) => ({
      id: row.id,
      leaseId: row.leaseId,
      tenantId: row.tenantId,
      role: row.role || "primary",
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.leaseTenant.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
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
    required: false,
    parseRow: (row) => ({
      id: row.id,
      propertyId: row.propertyId,
      insurer: parseString(row.insurer),
      policyNum: parseString(row.policyNum),
      agentName: parseString(row.agentName),
      premium: parseNumber(row.premium),
      dueDate: parseDate(row.dueDate),
      paidDate: parseDate(row.paidDate),
      phone: parseString(row.phone),
      webPortal: parseString(row.webPortal),
      allPolicies: parseString(row.allPolicies),
      bank: parseString(row.bank),
      bankNumber: parseString(row.bankNumber),
      loanRef: parseString(row.loanRef),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.insurancePolicy.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
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
    required: false,
    parseRow: (row) => ({
      id: row.id,
      propertyId: row.propertyId,
      annualAmount: parseNumber(row.annualAmount),
      dueDate: parseDate(row.dueDate),
      lastPaid: parseDate(row.lastPaid),
      parcel: parseString(row.parcel),
      billNumber: parseString(row.billNumber),
      phone: parseString(row.phone),
      name: parseString(row.name),
      address1: parseString(row.address1),
      address2: parseString(row.address2),
      city: parseString(row.city),
      state: parseString(row.state),
      zip: parseString(row.zip),
      web: parseString(row.web),
      email: parseString(row.email),
    }),
    upsert: async (rows) =>
      prisma.$transaction(async (tx) => {
        let count = 0;
        for (const data of rows) {
          await tx.propertyTaxAccount.upsert({
            where: { id: String(data.id) },
            update: data,
            create: data,
          });
          count++;
        }
        return count;
      }),
  },
];

async function main() {
  const { input } = parseArgs();
  if (!input) {
    throw new Error("Missing --in <folder> argument.");
  }

  const folder = path.resolve(process.cwd(), input);
  const stat = await fs.stat(folder).catch(() => null);
  if (!stat || !stat.isDirectory()) {
    throw new Error(`Input folder not found: ${folder}`);
  }

  for (const spec of importSpecs) {
    const filePath = path.join(folder, spec.filename);
    const fileExists = await fs
      .stat(filePath)
      .then((s) => s.isFile())
      .catch(() => false);

    if (!fileExists) {
      if (spec.required) {
        throw new Error(`Missing required CSV: ${spec.filename}`);
      }
      console.log(`${spec.name}: skipped (missing ${spec.filename})`);
      continue;
    }

    const records = await readCsvRecords(folder, spec.filename);
    const parsed = records.map(spec.parseRow);
    const count = await spec.upsert(parsed);
    console.log(`${spec.name}: imported ${count} rows`);
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
