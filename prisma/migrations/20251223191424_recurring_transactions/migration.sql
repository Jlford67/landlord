/*
  Warnings:

  - You are about to drop the column `estimatedValueCents` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedValueProviderRef` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedValueSource` on the `Property` table. All the data in the column will be lost.
  - You are about to drop the column `estimatedValueUpdatedAt` on the `Property` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nickname" TEXT,
    "street" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "doors" INTEGER,
    "beds" REAL,
    "baths" REAL,
    "sqFt" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Property" ("baths", "beds", "city", "createdAt", "doors", "id", "nickname", "notes", "sqFt", "state", "status", "street", "zip") SELECT "baths", "beds", "city", "createdAt", "doors", "id", "nickname", "notes", "sqFt", "state", "status", "street", "zip" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
