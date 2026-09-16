-- CreateEnum
CREATE TYPE "TextDirection" AS ENUM ('LTR', 'RTL');

-- CreateEnum
CREATE TYPE "MarketCode" AS ENUM ('IRAN', 'INTERNATIONAL');

-- CreateEnum
CREATE TYPE "LocalizedEntityType" AS ENUM ('CATEGORY', 'LISTING', 'ATTRIBUTE_DEFINITION');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PriceType" ADD VALUE 'CFR';
ALTER TYPE "PriceType" ADD VALUE 'DAP';
ALTER TYPE "PriceType" ADD VALUE 'DDP';

-- CreateTable
CREATE TABLE "Locale" (
    "code" TEXT NOT NULL,
    "nameNative" TEXT NOT NULL,
    "nameEn" TEXT NOT NULL,
    "direction" "TextDirection" NOT NULL DEFAULT 'LTR',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Locale_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "Market" (
    "code" "MarketCode" NOT NULL,
    "nameEn" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultCurrency" "CurrencyCode" NOT NULL,
    "allowedCurrencies" JSONB NOT NULL,
    "allowedIncoterms" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "LocalizedContent" (
    "id" TEXT NOT NULL,
    "entityType" "LocalizedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "localeCode" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LocalizedContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LocalizedContent_entityType_entityId_idx" ON "LocalizedContent"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "LocalizedContent_localeCode_idx" ON "LocalizedContent"("localeCode");

-- CreateIndex
CREATE UNIQUE INDEX "LocalizedContent_entityType_entityId_localeCode_field_key" ON "LocalizedContent"("entityType", "entityId", "localeCode", "field");
