-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('IRR', 'USD', 'EUR', 'AED', 'GBP');

-- CreateEnum
CREATE TYPE "PriceType" AS ENUM ('EXW', 'FOB', 'CIF', 'OTHER');

-- CreateEnum
CREATE TYPE "RoundingMode" AS ENUM ('NONE', 'ROUND_NEAREST', 'ROUND_UP', 'ROUND_DOWN');

-- CreateEnum
CREATE TYPE "InventoryLedgerType" AS ENUM ('IN', 'OUT', 'RESERVE', 'RELEASE', 'ADJUST');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('ACTIVE', 'RELEASED', 'CONSUMED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ListingPrice" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "supplierCost" DECIMAL(18,4) NOT NULL,
    "displayPrice" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "priceType" "PriceType" NOT NULL DEFAULT 'EXW',
    "fxRateApplied" DECIMAL(18,8),
    "marginPercentApplied" DECIMAL(8,4),
    "flatFeeApplied" DECIMAL(18,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ListingPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PricingSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT 'default',
    "marginPercent" DECIMAL(8,4) NOT NULL DEFAULT 0,
    "flatFee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "flatFeeCurrency" "CurrencyCode",
    "roundingMode" "RoundingMode" NOT NULL DEFAULT 'NONE',
    "roundingUnit" DECIMAL(18,4),
    "fxRates" JSONB,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PricingSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryBalance" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "onHand" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "reserved" DECIMAL(18,3) NOT NULL DEFAULT 0,
    "uomCode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLedgerEntry" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "type" "InventoryLedgerType" NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomCode" TEXT NOT NULL,
    "balanceOnHandAfter" DECIMAL(18,3) NOT NULL,
    "balanceReservedAfter" DECIMAL(18,3) NOT NULL,
    "reservationId" TEXT,
    "note" TEXT,
    "actorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomCode" TEXT NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "releasedAt" TIMESTAMP(3),

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitConversion" (
    "id" TEXT NOT NULL,
    "fromUom" TEXT NOT NULL,
    "toUom" TEXT NOT NULL,
    "factor" DECIMAL(24,12) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "UnitConversion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ListingPrice_listingId_key" ON "ListingPrice"("listingId");

-- CreateIndex
CREATE UNIQUE INDEX "PricingSettings_key_key" ON "PricingSettings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBalance_listingId_key" ON "InventoryBalance"("listingId");

-- CreateIndex
CREATE INDEX "InventoryLedgerEntry_listingId_createdAt_idx" ON "InventoryLedgerEntry"("listingId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryReservation_listingId_status_idx" ON "InventoryReservation"("listingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "UnitConversion_fromUom_toUom_key" ON "UnitConversion"("fromUom", "toUom");

-- AddForeignKey
ALTER TABLE "ListingPrice" ADD CONSTRAINT "ListingPrice_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBalance" ADD CONSTRAINT "InventoryBalance_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLedgerEntry" ADD CONSTRAINT "InventoryLedgerEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
