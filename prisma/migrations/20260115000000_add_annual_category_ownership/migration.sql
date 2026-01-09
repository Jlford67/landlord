-- DropIndex
DROP INDEX "AnnualCategoryAmount_propertyId_year_categoryId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AnnualCategoryAmount_propertyId_year_categoryId_propertyOwnershipId_key" ON "AnnualCategoryAmount"("propertyId", "year", "categoryId", "propertyOwnershipId");
