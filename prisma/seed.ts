import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * EDIT THESE BEFORE RUNNING SEED
 */
const SEED_USERS = [
  { email: "jlford67@gmail.com", password: "RealEstate-2025", role: "owner" as const },
  { email: "fordimelda@gmail.com", password: "RealEstate-2025", role: "spouse" as const },
];

const SEED_ENTITIES = [
  { name: "Personal", type: "personal" },
  { name: "LLC", type: "llc" },
];

type CategoryType = "income" | "expense" | "transfer";
type SeedCategory = { type: CategoryType; name: string; parent?: string };

const CATEGORIES: SeedCategory[] = [
  // Income
  { type: "income", name: "Rent" },
  { type: "income", name: "Late Fee" },
  { type: "income", name: "Other Income" },

  // Expenses
  { type: "expense", name: "Property Management" },
  { type: "expense", name: "Repairs & Maintenance" },
  { type: "expense", name: "Plumbing", parent: "Repairs & Maintenance" },
  { type: "expense", name: "Electrical", parent: "Repairs & Maintenance" },
  { type: "expense", name: "HVAC", parent: "Repairs & Maintenance" },
  { type: "expense", name: "Landscaping", parent: "Repairs & Maintenance" },
  { type: "expense", name: "Pest Control", parent: "Repairs & Maintenance" },

  { type: "expense", name: "Cleaning & Turnover" },
  { type: "expense", name: "Supplies" },

  { type: "expense", name: "Utilities" },
  { type: "expense", name: "Water", parent: "Utilities" },
  { type: "expense", name: "Electric", parent: "Utilities" },
  { type: "expense", name: "Gas", parent: "Utilities" },
  { type: "expense", name: "Trash", parent: "Utilities" },

  { type: "expense", name: "HOA" },
  { type: "expense", name: "Insurance" },
  { type: "expense", name: "Property Tax" },

  { type: "expense", name: "Advertising" },
  { type: "expense", name: "Legal & Professional" },
  { type: "expense", name: "Licenses & Permits" },
  { type: "expense", name: "Travel" },
  { type: "expense", name: "Bank Fees" },

  // Financing (optional tracking)
  { type: "expense", name: "Mortgage Interest" },
  { type: "expense", name: "Principal (Non-Expense)" },
  { type: "expense", name: "Escrow (Non-Expense)" },

  // Owner payout tracking
  { type: "transfer", name: "Owner Payout" },
  
    // =========================
  // Expanded Personal Expenses
  // =========================

  // Core recurring
  { type: "expense", name: "Mortgage Interest" },
  { type: "expense", name: "PMI" },
  { type: "expense", name: "Insurance" }, // already exists in many seeds; safe
  { type: "expense", name: "Property Tax" }, // already exists in many seeds; safe
  { type: "expense", name: "HOA/COA" }, // already exists-ish; keep exact text you want
  { type: "expense", name: "Dues & Subscriptions" },

  // Marketing / leasing
  { type: "expense", name: "Advertising" }, // already exists; safe
  { type: "expense", name: "Promotion/Incentives" },
  { type: "expense", name: "Referral Fee" },
  { type: "expense", name: "Rental Commission" },
  { type: "expense", name: "Lease Up Fee" },
  { type: "expense", name: "Renewal Fee" },
  { type: "expense", name: "RentClicks.com" },
  { type: "expense", name: "Rental Registration" },
  { type: "expense", name: "Application Processing Fee" },
  { type: "expense", name: "Credit Report", parent: "Application Processing Fee" },
  { type: "expense", name: "Collection Services" },

  // Legal / compliance
  { type: "expense", name: "Legal Fees" },
  { type: "expense", name: "Notary Fees" },
  { type: "expense", name: "License & Permits" }, // already exists; safe
  { type: "expense", name: "Business License", parent: "License & Permits" },
  { type: "expense", name: "Fees and Permits", parent: "License & Permits" },

  // Utilities
  { type: "expense", name: "Utilities" }, // already exists; safe
  { type: "expense", name: "Electric Bill / Gas", parent: "Utilities" },
  { type: "expense", name: "Water Bill", parent: "Utilities" },
  { type: "expense", name: "Sewer", parent: "Utilities" },
  { type: "expense", name: "Trash", parent: "Utilities" },
  { type: "expense", name: "Cable", parent: "Utilities" },

  // Repairs & Maintenance (use your existing parent if you have it)
  { type: "expense", name: "Maintenance & Repair" },
  { type: "expense", name: "Repairs", parent: "Maintenance & Repair" },
  { type: "expense", name: "Extraordinary Repairs", parent: "Maintenance & Repair" },
  { type: "expense", name: "Make Ready", parent: "Maintenance & Repair" },
  { type: "expense", name: "Rehab", parent: "Maintenance & Repair" },

  // Trades
  { type: "expense", name: "Plumbing", parent: "Maintenance & Repair" }, // already exists; safe
  { type: "expense", name: "Electric Repair", parent: "Maintenance & Repair" },
  { type: "expense", name: "Fence Repair", parent: "Maintenance & Repair" },
  { type: "expense", name: "Garage Repair", parent: "Maintenance & Repair" },
  { type: "expense", name: "Furnace Repair", parent: "Maintenance & Repair" },
  { type: "expense", name: "Roof/Gutters/Chimney", parent: "Maintenance & Repair" },
  { type: "expense", name: "Water Extraction", parent: "Maintenance & Repair" },
  { type: "expense", name: "Air Conditioner Install/Repair", parent: "Maintenance & Repair" },
  { type: "expense", name: "Heating/Cooling", parent: "Maintenance & Repair" },
  { type: "expense", name: "HVAC", parent: "Maintenance & Repair" }, // already exists; safe

  // Labor / vendors
  { type: "expense", name: "General Labor", parent: "Maintenance & Repair" },
  { type: "expense", name: "Hourly Service", parent: "Maintenance & Repair" },
  { type: "expense", name: "Exterminator Services", parent: "Maintenance & Repair" },

  // Turnover / cleaning
  { type: "expense", name: "Cleaning", parent: "Maintenance & Repair" },
  { type: "expense", name: "Carpet Cleaning/Install/Removal", parent: "Maintenance & Repair" },
  { type: "expense", name: "Paint", parent: "Maintenance & Repair" },
  { type: "expense", name: "Blinds Replacement", parent: "Maintenance & Repair" },
  { type: "expense", name: "Locksmith / Remotes", parent: "Maintenance & Repair" },
  { type: "expense", name: "Replacement Keys", parent: "Maintenance & Repair" },

  // Appliances
  { type: "expense", name: "Appliances" },
  { type: "expense", name: "Appliance Installation", parent: "Appliances" },
  { type: "expense", name: "Dishwasher", parent: "Appliances" },
  { type: "expense", name: "Oven/Stove", parent: "Appliances" },

  // Materials / supplies / parts
  { type: "expense", name: "Materials/Supplies" }, // already exists-ish; safe
  { type: "expense", name: "Lumber/Materials/Supplies", parent: "Materials/Supplies" },
  { type: "expense", name: "Inventory (Parts/Supplies)", parent: "Materials/Supplies" },
  { type: "expense", name: "Maintenance Parts", parent: "Materials/Supplies" },
  { type: "expense", name: "Non Inventory Parts", parent: "Materials/Supplies" },

  // Landscaping / grounds
  { type: "expense", name: "Grounds Maintenance" },
  { type: "expense", name: "Landscaping", parent: "Grounds Maintenance" }, // already exists; safe
  { type: "expense", name: "Lawn Service", parent: "Grounds Maintenance" },
  { type: "expense", name: "Vinyl Floor Replacement", parent: "Maintenance & Repair" },

  // Inspections / Section 8
  { type: "expense", name: "Home Inspection" },
  { type: "expense", name: "Property Inspection" },
  { type: "expense", name: "Section 8 Inspection" },

  // Fees / management / misc
  { type: "expense", name: "Management Fees" },
  { type: "expense", name: "Maintenance - Vendor Coord Fee", parent: "Management Fees" },
  { type: "expense", name: "Mark Up Expense", parent: "Management Fees" },
  { type: "expense", name: "Monthly Emergency Call Ans Svc", parent: "Management Fees" },

  { type: "expense", name: "Postage" },
  { type: "expense", name: "Sales Tax" },
  { type: "expense", name: "Travel Cost" }, // you already have Travel; keep if you want this exact name
  { type: "expense", name: "Other Expenses" },
  { type: "expense", name: "Misc / General", parent: "Other Expenses" },

  // Reimbursements / offsets (still expense type, but you can use negative amounts too)
  { type: "expense", name: "Insurance Reimbursement" },
  { type: "expense", name: "Utility Reimbursement" },

  // Special / vendor name
  { type: "expense", name: "Wiseman Advising LLC" },

];

// Prisma 7 requires an adapter (or accelerateUrl). For SQLite, use PrismaBetterSqlite3.
const adapter = new PrismaBetterSqlite3({
  url: "file:./prisma/landlord.db",
});

const prisma = new PrismaClient({ adapter });

async function upsertUsers() {
  for (const u of SEED_USERS) {
    const passwordHash = await bcrypt.hash(u.password, 12);

    await prisma.user.upsert({
      where: { email: u.email },
      update: { passwordHash, role: u.role },
      create: { email: u.email, passwordHash, role: u.role },
    });
  }
}

async function upsertEntities() {
  for (const e of SEED_ENTITIES) {
    const existing = await prisma.entity.findFirst({ where: { name: e.name } });
    if (existing) {
      await prisma.entity.update({ where: { id: existing.id }, data: { type: e.type } });
    } else {
      await prisma.entity.create({ data: { name: e.name, type: e.type } });
    }
  }
}

async function upsertCategories() {
  const parents = CATEGORIES.filter((c) => !c.parent);
  const children = CATEGORIES.filter((c) => c.parent);

  const createdByKey = new Map<string, string>(); // key => id

  for (const c of parents) {
    const existing = await prisma.category.findFirst({
      where: { type: c.type, name: c.name },
      select: { id: true },
    });

    const row = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: { active: true, parentId: null },
        })
      : await prisma.category.create({
          data: { type: c.type, name: c.name, active: true },
        });

    createdByKey.set(`${c.type}:${c.name}`, row.id);
  }

  for (const c of children) {
    const parentId = createdByKey.get(`${c.type}:${c.parent}`);
    if (!parentId) throw new Error(`Missing parent category for: ${c.type}/${c.name} -> ${c.parent}`);

    const existing = await prisma.category.findFirst({
     where: { type: c.type, name: c.name },
     select: { id: true },
    });

    const row = existing
      ? await prisma.category.update({
          where: { id: existing.id },
          data: { active: true, parentId },
        })
      : await prisma.category.create({
          data: { type: c.type, name: c.name, active: true, parentId },
        });

    createdByKey.set(`${c.type}:${c.name}`, row.id);
  }
}

async function seedNotificationRules() {
  const users = await prisma.user.findMany({ select: { id: true } });

  const defaults = [
    { ruleType: "lease_expiry", daysBefore: 60, channels: '["in_app","email"]' },
    { ruleType: "lease_expiry", daysBefore: 30, channels: '["in_app","email"]' },
    { ruleType: "insurance_due", daysBefore: 30, channels: '["in_app","email"]' },
    { ruleType: "insurance_due", daysBefore: 14, channels: '["in_app","email"]' },
    { ruleType: "tax_due", daysBefore: 30, channels: '["in_app","email"]' },
    { ruleType: "tax_due", daysBefore: 14, channels: '["in_app","email"]' },
  ];

  for (const u of users) {
    for (const d of defaults) {
      const existing = await prisma.notificationRule.findFirst({
        where: { userId: u.id, ruleType: d.ruleType, daysBefore: d.daysBefore },
        select: { id: true },
      });

      if (existing) {
        await prisma.notificationRule.update({
          where: { id: existing.id },
          data: { channels: d.channels, enabled: true },
        });
      } else {
        await prisma.notificationRule.create({
          data: { userId: u.id, ...d, enabled: true },
        });
      }
    }
  }
}

async function main() {
  await upsertUsers();
  await upsertEntities();
  await upsertCategories();
  await seedNotificationRules();
  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
