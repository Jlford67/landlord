-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "deletedAt" DATETIME;

-- CreateIndex
CREATE INDEX "Transaction_propertyId_deletedAt_idx" ON "Transaction"("propertyId", "deletedAt");
