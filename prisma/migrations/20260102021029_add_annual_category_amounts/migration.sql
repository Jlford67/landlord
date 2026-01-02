-- CreateTable
CREATE TABLE "AnnualCategoryAmount" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "propertyOwnershipId" TEXT,
    CONSTRAINT "AnnualCategoryAmount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnualCategoryAmount_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AnnualCategoryAmount_propertyOwnershipId_fkey" FOREIGN KEY ("propertyOwnershipId") REFERENCES "PropertyOwnership" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AnnualCategoryAmount_propertyId_year_idx" ON "AnnualCategoryAmount"("propertyId", "year");

-- CreateIndex
CREATE INDEX "AnnualCategoryAmount_categoryId_idx" ON "AnnualCategoryAmount"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnualCategoryAmount_propertyId_year_categoryId_key" ON "AnnualCategoryAmount"("propertyId", "year", "categoryId");
