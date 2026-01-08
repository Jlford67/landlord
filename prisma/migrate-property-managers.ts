import Database from "better-sqlite3";
import crypto from "node:crypto";

const dbPath = process.argv[2] || "prisma/landlord.db";
const cleanup = process.argv.includes("--cleanup");

const db = new Database(dbPath);

db.pragma("foreign_keys = OFF");

function tableExists(name: string) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(name);
  return Boolean(row);
}

if (!tableExists("PropertyManagerLegacy") || !tableExists("PropertyManagerAssignmentLegacy")) {
  console.log("Legacy property manager tables not found. Nothing to migrate.");
  process.exit(0);
}

const legacyManagers = db.prepare("SELECT * FROM PropertyManagerLegacy").all();
const legacyAssignments = db.prepare("SELECT * FROM PropertyManagerAssignmentLegacy").all();

const companyMap = new Map<string, { id: string; name: string; phone: string | null; email: string | null; website: string | null; address1: string | null; city: string | null; state: string | null; zip: string | null; notes: string | null }>();

for (const row of legacyManagers) {
  const name = String(row.companyName ?? "").trim();
  if (!name) continue;
  if (!companyMap.has(name)) {
    companyMap.set(name, {
      id: crypto.randomUUID(),
      name,
      phone: row.phone ?? null,
      email: row.email ?? null,
      website: row.website ?? null,
      address1: row.address1 ?? null,
      city: row.city ?? null,
      state: row.state ?? null,
      zip: row.zip ?? null,
      notes: null,
    });
  }
}

const insertCompany = db.prepare(
  `INSERT INTO PropertyManagerCompany (id, name, phone, email, website, address1, city, state, zip, notes)
   VALUES (@id, @name, @phone, @email, @website, @address1, @city, @state, @zip, @notes)
   ON CONFLICT(name) DO NOTHING`
);

for (const company of companyMap.values()) {
  insertCompany.run(company);
}

const contactMap = new Map<string, { id: string; companyId: string; name: string; phone: string | null; email: string | null; notes: string | null }>();

for (const row of legacyManagers) {
  const companyName = String(row.companyName ?? "").trim();
  const company = companyMap.get(companyName);
  if (!company) continue;

  const contactName = String(row.contactName ?? "").trim();
  if (!contactName) continue;

  const email = row.email ?? null;
  const key = `${company.id}::${contactName}::${email ?? ""}`;
  if (!contactMap.has(key)) {
    contactMap.set(key, {
      id: crypto.randomUUID(),
      companyId: company.id,
      name: contactName,
      phone: row.phone ?? null,
      email,
      notes: null,
    });
  }
}

const insertContact = db.prepare(
  `INSERT INTO PropertyManagerContact (id, companyId, name, phone, email, notes)
   VALUES (@id, @companyId, @name, @phone, @email, @notes)`
);

for (const contact of contactMap.values()) {
  insertContact.run(contact);
}

const insertAssignment = db.prepare(
  `INSERT INTO PropertyManagerAssignment (id, propertyId, companyId, contactId, startDate, endDate, notes)
   VALUES (@id, @propertyId, @companyId, @contactId, @startDate, @endDate, @notes)
   ON CONFLICT(propertyId) DO UPDATE SET
     companyId=excluded.companyId,
     contactId=excluded.contactId,
     startDate=excluded.startDate,
     endDate=excluded.endDate,
     notes=excluded.notes`
);

for (const assignment of legacyAssignments) {
  const legacyManager = legacyManagers.find((row) => row.id === assignment.pmId);
  if (!legacyManager) continue;

  const companyName = String(legacyManager.companyName ?? "").trim();
  const company = companyMap.get(companyName);
  if (!company) continue;

  let contactId: string | null = null;
  if (legacyManager.contactName) {
    const email = legacyManager.email ?? null;
    const key = `${company.id}::${legacyManager.contactName}::${email ?? ""}`;
    contactId = contactMap.get(key)?.id ?? null;
  }

  insertAssignment.run({
    id: crypto.randomUUID(),
    propertyId: assignment.propertyId,
    companyId: company.id,
    contactId,
    startDate: assignment.startDate ?? null,
    endDate: assignment.endDate ?? null,
    notes: assignment.notes ?? null,
  });
}

if (cleanup) {
  db.exec("DROP TABLE IF EXISTS PropertyManagerLegacy;");
  db.exec("DROP TABLE IF EXISTS PropertyManagerAssignmentLegacy;");
}

console.log("Property manager data migration complete.");
