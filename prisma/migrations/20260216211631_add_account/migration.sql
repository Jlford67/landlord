-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "AccountMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountMember_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AccountMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Property" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT,
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
    "purchasePriceCents" INTEGER,
    "purchaseDate" DATETIME,
    "soldPriceCents" INTEGER,
    "soldDate" DATETIME,
    "notes" TEXT,
    "zillowUrl" TEXT,
    "redfinUrl" TEXT,
    "zillowEstimatedValue" INTEGER,
    "zillowEstimatedValueUpdatedAt" DATETIME,
    "redfinEstimatedValue" INTEGER,
    "redfinEstimatedValueUpdatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Property_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Property" ("baths", "beds", "city", "createdAt", "doors", "id", "nickname", "notes", "purchaseDate", "purchasePriceCents", "redfinEstimatedValue", "redfinEstimatedValueUpdatedAt", "redfinUrl", "soldDate", "soldPriceCents", "sqFt", "state", "status", "street", "zillowEstimatedValue", "zillowEstimatedValueUpdatedAt", "zillowUrl", "zip") SELECT "baths", "beds", "city", "createdAt", "doors", "id", "nickname", "notes", "purchaseDate", "purchasePriceCents", "redfinEstimatedValue", "redfinEstimatedValueUpdatedAt", "redfinUrl", "soldDate", "soldPriceCents", "sqFt", "state", "status", "street", "zillowEstimatedValue", "zillowEstimatedValueUpdatedAt", "zillowUrl", "zip" FROM "Property";
DROP TABLE "Property";
ALTER TABLE "new_Property" RENAME TO "Property";
CREATE INDEX "Property_accountId_idx" ON "Property"("accountId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Account_name_key" ON "Account"("name");

-- CreateIndex
CREATE INDEX "AccountMember_userId_idx" ON "AccountMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountMember_accountId_userId_key" ON "AccountMember"("accountId", "userId");
