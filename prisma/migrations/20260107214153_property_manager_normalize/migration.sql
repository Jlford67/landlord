/*
  NOTE:
  Legacy Property Manager tables are renamed for a one-time data migration.
  See prisma/migrate-property-managers.ts for the copy script.
*/
PRAGMA foreign_keys=off;
ALTER TABLE "PropertyManager" RENAME TO "PropertyManagerLegacy";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "PropertyManagerCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "address1" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "notes" TEXT
);

-- CreateTable
CREATE TABLE "PropertyManagerContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    CONSTRAINT "PropertyManagerContact_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PropertyManagerCompany" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
ALTER TABLE "PropertyManagerAssignment" RENAME TO "PropertyManagerAssignmentLegacy";

CREATE TABLE "PropertyManagerAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contactId" TEXT,
    "startDate" DATETIME,
    "endDate" DATETIME,
    "notes" TEXT,
    CONSTRAINT "PropertyManagerAssignment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PropertyManagerAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "PropertyManagerCompany" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PropertyManagerAssignment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "PropertyManagerContact" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PropertyManagerAssignment_propertyId_key" ON "PropertyManagerAssignment"("propertyId");
CREATE INDEX "PropertyManagerAssignment_companyId_idx" ON "PropertyManagerAssignment"("companyId");
CREATE INDEX "PropertyManagerAssignment_contactId_idx" ON "PropertyManagerAssignment"("contactId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PropertyManagerCompany_name_key" ON "PropertyManagerCompany"("name");

-- CreateIndex
CREATE INDEX "PropertyManagerContact_companyId_idx" ON "PropertyManagerContact"("companyId");
