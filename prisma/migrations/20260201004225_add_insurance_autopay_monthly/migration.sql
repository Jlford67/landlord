-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AnnualCategoryAmount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "importKey" TEXT NOT NULL DEFAULT '',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "propertyOwnershipId" TEXT,
    CONSTRAINT "AnnualCategoryAmount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnualCategoryAmount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnualCategoryAmount_propertyOwnershipId_fkey" FOREIGN KEY ("propertyOwnershipId") REFERENCES "PropertyOwnership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AnnualCategoryAmount" ("amount", "categoryId", "createdAt", "id", "importKey", "note", "propertyId", "propertyOwnershipId", "updatedAt", "year") SELECT "amount", "categoryId", "createdAt", "id", coalesce("importKey", '') AS "importKey", "note", "propertyId", "propertyOwnershipId", "updatedAt", "year" FROM "AnnualCategoryAmount";
DROP TABLE "AnnualCategoryAmount";
ALTER TABLE "new_AnnualCategoryAmount" RENAME TO "AnnualCategoryAmount";
CREATE INDEX "AnnualCategoryAmount_propertyId_year_idx" ON "AnnualCategoryAmount"("propertyId", "year");
CREATE INDEX "AnnualCategoryAmount_categoryId_idx" ON "AnnualCategoryAmount"("categoryId");
CREATE UNIQUE INDEX "AnnualCategoryAmount_propertyId_year_categoryId_propertyOwnershipId_importKey_key" ON "AnnualCategoryAmount"("propertyId", "year", "categoryId", "propertyOwnershipId", "importKey");
CREATE TABLE "new_InsurancePolicy" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "insurer" TEXT,
    "policyNum" TEXT,
    "agentName" TEXT,
    "premium" REAL,
    "dueDate" DATETIME,
    "paidDate" DATETIME,
    "phone" TEXT,
    "webPortal" TEXT,
    "allPolicies" TEXT,
    "bank" TEXT,
    "bankNumber" TEXT,
    "loanRef" TEXT,
    "autoPayMonthly" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InsurancePolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_InsurancePolicy" ("agentName", "allPolicies", "bank", "bankNumber", "dueDate", "id", "insurer", "loanRef", "paidDate", "phone", "policyNum", "premium", "propertyId", "webPortal") SELECT "agentName", "allPolicies", "bank", "bankNumber", "dueDate", "id", "insurer", "loanRef", "paidDate", "phone", "policyNum", "premium", "propertyId", "webPortal" FROM "InsurancePolicy";
DROP TABLE "InsurancePolicy";
ALTER TABLE "new_InsurancePolicy" RENAME TO "InsurancePolicy";
CREATE INDEX "InsurancePolicy_propertyId_idx" ON "InsurancePolicy"("propertyId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
