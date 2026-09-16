-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "rfqTargetId" TEXT,
    "sellerOrganizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "QuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" "CurrencyCode" NOT NULL,
    "priceType" "PriceType" NOT NULL DEFAULT 'EXW',
    "validUntil" TIMESTAMP(3),
    "sellerNotes" TEXT,
    "totalDisplayPrice" DECIMAL(18,4),
    "totalBasePrice" DECIMAL(18,4),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteItem" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqItemId" TEXT,
    "listingId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
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
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_publicId_key" ON "Quote"("publicId");

-- CreateIndex
CREATE INDEX "Quote_rfqId_sellerOrganizationId_idx" ON "Quote"("rfqId", "sellerOrganizationId");

-- CreateIndex
CREATE INDEX "Quote_sellerOrganizationId_status_idx" ON "Quote"("sellerOrganizationId", "status");

-- CreateIndex
CREATE INDEX "Quote_status_createdAt_idx" ON "Quote"("status", "createdAt");

-- CreateIndex
CREATE INDEX "QuoteItem_quoteId_idx" ON "QuoteItem"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteItem_listingId_idx" ON "QuoteItem"("listingId");

-- CreateIndex
CREATE INDEX "QuoteItem_rfqItemId_idx" ON "QuoteItem"("rfqItemId");

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_rfqTargetId_fkey" FOREIGN KEY ("rfqTargetId") REFERENCES "RfqTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteItem" ADD CONSTRAINT "QuoteItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
