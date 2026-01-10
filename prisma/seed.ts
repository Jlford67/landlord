import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

/**
 * Seed is AUTH ONLY.
 * Real app data should be restored via import-core.ts and import-annual.ts.
 */

const SEED_USERS = [
  { email: "jlford67@gmail.com", password: "RealEstate-2025", role: "owner" as const },
  { email: "fordimelda@gmail.com", password: "RealEstate-2025", role: "spouse" as const },
];

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

async function main() {
  await upsertUsers();
  console.log("Seed complete: users created/updated");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
