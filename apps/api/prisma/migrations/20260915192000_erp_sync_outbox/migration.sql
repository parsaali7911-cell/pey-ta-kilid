CREATE TYPE "ErpSyncStatus" AS ENUM ('PENDING', 'SYNCING', 'SUCCESS', 'FAILED', 'RETRYING');
ALTER TYPE "ErpOutboxStatus" ADD VALUE 'RETRYING';

ALTER TABLE "Organization" ADD COLUMN "erpCustomerExternalId" TEXT;
ALTER TABLE "Organization" ADD COLUMN "erpSupplierExternalId" TEXT;

ALTER TABLE "Listing" ADD COLUMN "erpItemExternalId" TEXT;

ALTER TABLE "Order" ADD COLUMN "erpExternalId" TEXT;
ALTER TABLE "Order" ADD COLUMN "erpSyncStatus" "ErpSyncStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Order" ADD COLUMN "erpLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "erpSyncError" TEXT;
CREATE INDEX "Order_erpSyncStatus_idx" ON "Order"("erpSyncStatus");
CREATE INDEX "Order_erpExternalId_idx" ON "Order"("erpExternalId");

ALTER TABLE "Payment" ADD COLUMN "erpExternalId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "erpSyncStatus" "ErpSyncStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Payment" ADD COLUMN "erpLastSyncedAt" TIMESTAMP(3);
ALTER TABLE "Payment" ADD COLUMN "erpSyncError" TEXT;
CREATE INDEX "Payment_erpSyncStatus_idx" ON "Payment"("erpSyncStatus");
CREATE INDEX "Payment_erpExternalId_idx" ON "Payment"("erpExternalId");

ALTER TABLE "ErpOutboxEvent" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "ErpOutboxEvent" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "ErpOutboxEvent" ADD COLUMN "lastError" TEXT;
ALTER TABLE "ErpOutboxEvent" ADD COLUMN "externalId" TEXT;
ALTER TABLE "ErpOutboxEvent" ADD COLUMN "result" JSONB;
ALTER TABLE "ErpOutboxEvent" ADD COLUMN "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
DROP INDEX IF EXISTS "ErpOutboxEvent_status_createdAt_idx";
CREATE INDEX "ErpOutboxEvent_status_scheduledAt_idx" ON "ErpOutboxEvent"("status", "scheduledAt");
