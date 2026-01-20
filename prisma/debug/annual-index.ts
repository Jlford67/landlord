/**
 * Debug utility:
 * Inspects SQLite columns and unique indexes for AnnualCategoryAmount.
 * Safe to run. Read-only. Intended for schema/migration debugging.
 */

import { prisma } from "../src/lib/db";

async function main() {
  const cols = await prisma.$queryRawUnsafe<any[]>(
    "PRAGMA table_info('AnnualCategoryAmount');"
  );
  console.log("COLUMNS:");
  console.table(cols);

  const idx = await prisma.$queryRawUnsafe<any[]>(
    "PRAGMA index_list('AnnualCategoryAmount');"
  );
  console.log("INDEX_LIST:");
  console.table(idx);

  for (const i of idx) {
    if (i.unique) {
      const info = await prisma.$queryRawUnsafe<any[]>(
        `PRAGMA index_info('${i.name}');`
      );
      console.log(`INDEX_INFO: ${i.name}`);
      console.table(info);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
