-- AlterTable
ALTER TABLE "Property" ADD COLUMN "estimatedValueCents" INTEGER;
ALTER TABLE "Property" ADD COLUMN "estimatedValueProviderRef" TEXT;
ALTER TABLE "Property" ADD COLUMN "estimatedValueSource" TEXT;
ALTER TABLE "Property" ADD COLUMN "estimatedValueUpdatedAt" DATETIME;
