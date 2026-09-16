-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('CONFIRMED', 'AWAITING_PAYMENT', 'PARTIALLY_PAID', 'PAID', 'CANCELLED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUBMITTED', 'CONFIRMED', 'FAILED', 'CANCELLED');
CREATE TYPE "PaymentMethod" AS ENUM ('BANK_TRANSFER', 'MANUAL', 'OTHER');
CREATE TYPE "ErpOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable InventoryReservation
ALTER TABLE "InventoryReservation" ADD COLUMN "orderId" TEXT;
ALTER TABLE "InventoryReservation" ADD COLUMN "orderItemId" TEXT;

-- CreateTable Order
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "currency" "CurrencyCode" NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "totalDisplayPrice" DECIMAL(18,4) NOT NULL,
    "totalBasePrice" DECIMAL(18,4) NOT NULL,
    "paymentTermsCode" TEXT NOT NULL DEFAULT '100_ADVANCE',
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "quoteItemId" TEXT,
    "listingId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "facilityId" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomCode" TEXT NOT NULL,
    "basePrice" DECIMAL(18,4) NOT NULL,
    "displayPrice" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "priceType" "PriceType" NOT NULL,
    "fxRateApplied" DECIMAL(18,8),
    "marginPercentApplied" DECIMAL(8,4),
    "flatFeeApplied" DECIMAL(18,4),
    "leadTimeDays" INTEGER,
    "titleSnapshot" TEXT,
    "lineDisplayTotal" DECIMAL(18,4) NOT NULL,
    "lineBaseTotal" DECIMAL(18,4) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrderPaymentSchedule" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "termsCode" TEXT NOT NULL,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderPaymentSchedule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PaymentInstallment" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "label" TEXT,
    "percent" DECIMAL(5,2) NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentInstallment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "reference" TEXT,
    "submittedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ErpOutboxEvent" (
    "id" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "ErpOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "ErpOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Order_publicId_key" ON "Order"("publicId");
CREATE UNIQUE INDEX "Order_quoteId_key" ON "Order"("quoteId");
CREATE INDEX "Order_buyerOrganizationId_status_idx" ON "Order"("buyerOrganizationId", "status");
CREATE INDEX "Order_sellerOrganizationId_status_idx" ON "Order"("sellerOrganizationId", "status");
CREATE INDEX "Order_rfqId_idx" ON "Order"("rfqId");
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_listingId_idx" ON "OrderItem"("listingId");
CREATE INDEX "OrderItem_facilityId_idx" ON "OrderItem"("facilityId");

CREATE UNIQUE INDEX "OrderPaymentSchedule_orderId_key" ON "OrderPaymentSchedule"("orderId");
CREATE UNIQUE INDEX "PaymentInstallment_scheduleId_sequence_key" ON "PaymentInstallment"("scheduleId", "sequence");
CREATE INDEX "PaymentInstallment_status_dueDate_idx" ON "PaymentInstallment"("status", "dueDate");

CREATE UNIQUE INDEX "Payment_publicId_key" ON "Payment"("publicId");
CREATE UNIQUE INDEX "Payment_idempotencyKey_key" ON "Payment"("idempotencyKey");
CREATE INDEX "Payment_orderId_status_idx" ON "Payment"("orderId", "status");

CREATE UNIQUE INDEX "ErpOutboxEvent_idempotencyKey_key" ON "ErpOutboxEvent"("idempotencyKey");
CREATE INDEX "ErpOutboxEvent_status_createdAt_idx" ON "ErpOutboxEvent"("status", "createdAt");
CREATE INDEX "ErpOutboxEvent_entityType_entityId_idx" ON "ErpOutboxEvent"("entityType", "entityId");

CREATE UNIQUE INDEX "InventoryReservation_orderId_listingId_key" ON "InventoryReservation"("orderId", "listingId");
CREATE INDEX "InventoryReservation_orderId_idx" ON "InventoryReservation"("orderId");

ALTER TABLE "Order" ADD CONSTRAINT "Order_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Order" ADD CONSTRAINT "Order_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "Facility"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrderPaymentSchedule" ADD CONSTRAINT "OrderPaymentSchedule_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PaymentInstallment" ADD CONSTRAINT "PaymentInstallment_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "OrderPaymentSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
