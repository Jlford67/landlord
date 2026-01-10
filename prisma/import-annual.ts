import { prisma } from "../src/lib/db";
import fs from "fs";
import path from "path";

type Row = {
  property: string;
  year: number;
  category: string;
  amount: number;
  note?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur.trim());
  return out;
}

function mustNumber(v: string, label: string) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Invalid number for ${label}: "${v}"`);
  return n;
}

async function main() {
  const csvPath = path.resolve(process.cwd(), "prisma", "annual-import.csv");
  if (!fs.existsSync(csvPath)) throw new Error(`Missing CSV file: ${csvPath}`);

  const raw = fs.readFileSync(csvPath, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) throw new Error("CSV must include header + at least one row");

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const idx = (name: string) => {
    const i = header.indexOf(name);
    if (i === -1) throw new Error(`Missing required column "${name}" in CSV header`);
    return i;
  };

  const iProperty = idx("property");
  const iYear = idx("year");
  const iCategory = idx("category");
  const iAmount = idx("amount");
  const iNote = header.indexOf("note");

  const rows: Row[] = lines.slice(1).map((line, n) => {
    const cols = parseCsvLine(line);
    const property = (cols[iProperty] ?? "").trim();
    const year = Math.trunc(mustNumber(cols[iYear] ?? "", "year"));
    const category = (cols[iCategory] ?? "").trim();
    const amount = Math.abs(mustNumber(cols[iAmount] ?? "", "amount"));
    const note = iNote >= 0 ? (cols[iNote] ?? "").trim() : "";

    if (!property) throw new Error(`Row ${n + 2}: property is blank`);
    if (!category) throw new Error(`Row ${n + 2}: category is blank`);
    if (!Number.isFinite(year) || year < 1900 || year > 3000) {
      throw new Error(`Row ${n + 2}: invalid year "${cols[iYear]}"`);
    }

    return { property, year, category, amount, note: note || undefined };
  });

  // Properties lookup
  const properties = await prisma.property.findMany({
    select: { id: true, nickname: true, street: true },
  });

  const propertyByLabel = new Map<string, string>();
  for (const p of properties) {
    const labels = [(p.nickname ?? "").trim(), (p.street ?? "").trim()].filter(Boolean);
    for (const label of labels) propertyByLabel.set(label.toLowerCase(), p.id);
  }

  // Ownership lookup (choose a deterministic default per property)
  // NOTE: PropertyOwnership has no createdAt in this schema, so we pick the latest by id.
  const ownerships = await prisma.propertyOwnership.findMany({
    select: {
      id: true,
      propertyId: true,
    },
    orderBy: [{ propertyId: "asc" }, { id: "desc" }],
  });
  
  const ownershipByProperty = new Map<string, string>();
  for (const o of ownerships) {
    // Because we ordered desc by id, first we see for each property is "latest"
    if (!ownershipByProperty.has(o.propertyId)) {
      ownershipByProperty.set(o.propertyId, o.id);
    }
  }
  
  // Categories lookup
  const categories = await prisma.category.findMany({
    select: { id: true, name: true, type: true },
  });

  const categoryByName = new Map<string, { id: string; type: string }>();
  for (const c of categories) {
    categoryByName.set(c.name.trim().toLowerCase(), { id: c.id, type: c.type });
  }

  let created = 0;
  let updated = 0;

  for (const r of rows) {
    const propertyId = propertyByLabel.get(r.property.toLowerCase());
    if (!propertyId) {
      throw new Error(`Property not found for "${r.property}". Fix CSV to match property nickname/street.`);
    }

    const propertyOwnershipId = ownershipByProperty.get(propertyId);
    if (!propertyOwnershipId) {
      throw new Error(
        `No PropertyOwnership found for property "${r.property}" (${propertyId}). Create ownership record(s) first.`
      );
    }

    const cat = categoryByName.get(r.category.toLowerCase());
    if (!cat) {
      throw new Error(`Category not found for "${r.category}". Create it in Categories first, or fix CSV.`);
    }
    if (cat.type === "transfer") {
      throw new Error(`Category "${r.category}" is type "transfer" which is not allowed for annual data.`);
    }

    const signedAmount = cat.type === "expense" ? -r.amount : r.amount;

    const existing = await prisma.annualCategoryAmount.findUnique({
      where: {
        propertyId_year_categoryId_propertyOwnershipId: {
          propertyId,
          year: r.year,
          categoryId: cat.id,
          propertyOwnershipId,
        },
      },
      select: { id: true },
    });

    await prisma.annualCategoryAmount.upsert({
      where: {
        propertyId_year_categoryId_propertyOwnershipId: {
          propertyId,
          year: r.year,
          categoryId: cat.id,
          propertyOwnershipId,
        },
      },
      update: {
        amount: signedAmount,
        note: r.note ?? null,
        propertyOwnershipId,
      },
      create: {
        propertyId,
        year: r.year,
        categoryId: cat.id,
        amount: signedAmount,
        note: r.note ?? null,
        propertyOwnershipId,
      },
    });

    if (existing) updated++;
    else created++;
  }

  console.log(`Done. Created: ${created}, Updated: ${updated}, Total rows: ${rows.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
