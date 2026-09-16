-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RESPONDED', 'QUOTED', 'ACCEPTED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "buyerOrganizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "status" "RfqStatus" NOT NULL DEFAULT 'DRAFT',
    "requirementsSnapshot" JSONB NOT NULL,
    "buyerNotes" TEXT,
    "market" TEXT,
    "locale" TEXT,
    "budgetMin" DECIMAL(18,4),
    "budgetMax" DECIMAL(18,4),
    "budgetCurrency" TEXT,
    "destinationCountryCode" TEXT,
    "destinationRegion" TEXT,
    "destinationProvince" TEXT,
    "destinationCity" TEXT,
    "requestedLeadTimeDays" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqItem" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "listingId" TEXT,
    "productId" TEXT,
    "variantId" TEXT,
    "categoryId" TEXT,
    "sellerOrganizationId" TEXT,
    "titleSnapshot" TEXT,
    "quantity" DECIMAL(18,3) NOT NULL,
    "uomCode" TEXT NOT NULL,
    "attributeFilters" JSONB,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqTarget" (
    "id" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "sellerOrganizationId" TEXT NOT NULL,
    "listingId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_publicId_key" ON "Rfq"("publicId");

-- CreateIndex
CREATE INDEX "Rfq_buyerOrganizationId_status_idx" ON "Rfq"("buyerOrganizationId", "status");

-- CreateIndex
CREATE INDEX "Rfq_createdByUserId_idx" ON "Rfq"("createdByUserId");

-- CreateIndex
CREATE INDEX "Rfq_status_createdAt_idx" ON "Rfq"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RfqItem_rfqId_idx" ON "RfqItem"("rfqId");

-- CreateIndex
CREATE INDEX "RfqItem_listingId_idx" ON "RfqItem"("listingId");

-- CreateIndex
CREATE INDEX "RfqItem_sellerOrganizationId_idx" ON "RfqItem"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "RfqTarget_rfqId_idx" ON "RfqTarget"("rfqId");

-- CreateIndex
CREATE INDEX "RfqTarget_sellerOrganizationId_idx" ON "RfqTarget"("sellerOrganizationId");

-- CreateIndex
CREATE INDEX "RfqTarget_listingId_idx" ON "RfqTarget"("listingId");

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_buyerOrganizationId_fkey" FOREIGN KEY ("buyerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqItem" ADD CONSTRAINT "RfqItem_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqTarget" ADD CONSTRAINT "RfqTarget_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqTarget" ADD CONSTRAINT "RfqTarget_sellerOrganizationId_fkey" FOREIGN KEY ("sellerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqTarget" ADD CONSTRAINT "RfqTarget_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
