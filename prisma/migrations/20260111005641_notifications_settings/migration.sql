-- CreateTable
CREATE TABLE "NotificationSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "emailAddress" TEXT,
    "emailSendTimeLocal" TEXT NOT NULL DEFAULT '08:00',
    "insuranceEnabled" BOOLEAN NOT NULL DEFAULT true,
    "insuranceStartDays" INTEGER NOT NULL DEFAULT 60,
    "insuranceOffsetsCsv" TEXT NOT NULL DEFAULT '60,30,14,7,1',
    "insuranceOverdueDaily" BOOLEAN NOT NULL DEFAULT true,
    "propertyTaxEnabled" BOOLEAN NOT NULL DEFAULT true,
    "propertyTaxStartDays" INTEGER NOT NULL DEFAULT 60,
    "propertyTaxOffsetsCsv" TEXT NOT NULL DEFAULT '60,30,14,7,1',
    "propertyTaxOverdueDaily" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "NotificationEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "propertyId" TEXT,
    "relatedEntityId" TEXT,
    "dueDate" DATETIME,
    "message" TEXT NOT NULL,
    "acknowledgedAt" DATETIME,
    "sentAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "dedupeKey" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "NotificationEvent_dedupeKey_key" ON "NotificationEvent"("dedupeKey");
