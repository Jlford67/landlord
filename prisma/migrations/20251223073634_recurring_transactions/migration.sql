-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "propertyId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "memo" TEXT,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "startMonth" TEXT NOT NULL,
    "endMonth" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RecurringTransaction_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RecurringPosting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recurringTransactionId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "ledgerTransactionId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecurringPosting_recurringTransactionId_fkey" FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RecurringTransaction_propertyId_idx" ON "RecurringTransaction"("propertyId");

-- CreateIndex
CREATE INDEX "RecurringTransaction_categoryId_idx" ON "RecurringTransaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringPosting_ledgerTransactionId_key" ON "RecurringPosting"("ledgerTransactionId");

-- CreateIndex
CREATE INDEX "RecurringPosting_month_idx" ON "RecurringPosting"("month");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringPosting_recurringTransactionId_month_key" ON "RecurringPosting"("recurringTransactionId", "month");
