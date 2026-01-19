-- AlterTable
ALTER TABLE "AnnualCategoryAmount" ADD COLUMN "importKey" TEXT;

-- DropIndex
DROP INDEX "AnnualCategoryAmount_propertyId_year_categoryId_propertyOwnershipId_key";

-- CreateIndex
CREATE UNIQUE INDEX "AnnualCategoryAmount_propertyId_year_categoryId_propertyOwnershipId_importKey_key" ON "AnnualCategoryAmount"("propertyId", "year", "categoryId", "propertyOwnershipId", "importKey");
