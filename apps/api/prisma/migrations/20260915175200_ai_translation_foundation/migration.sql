-- AlterEnum
CREATE TYPE "TranslationStatus" AS ENUM ('PENDING', 'READY', 'FAILED', 'STALE', 'SKIPPED');

-- AlterEnum
CREATE TYPE "AiUsageOperation" AS ENUM ('TRANSLATION', 'COMPLETE', 'EMBED', 'VISION');

-- CreateTable
CREATE TABLE "TranslationRecord" (
    "id" TEXT NOT NULL,
    "entityType" "LocalizedEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "sourceLocale" TEXT NOT NULL,
    "targetLocale" TEXT NOT NULL,
    "sourceHash" TEXT NOT NULL,
    "translatedText" TEXT,
    "status" "TranslationStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT,
    "model" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TranslationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsageEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "operation" "AiUsageOperation" NOT NULL,
    "sourceLocale" TEXT,
    "targetLocale" TEXT,
    "model" TEXT,
    "requestCount" INTEGER NOT NULL DEFAULT 1,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "estimatedCostUsd" DECIMAL(12,6),
    "entityType" TEXT,
    "entityId" TEXT,
    "field" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiUsageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TranslationRecord_entityType_entityId_idx" ON "TranslationRecord"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "TranslationRecord_status_updatedAt_idx" ON "TranslationRecord"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "TranslationRecord_sourceHash_idx" ON "TranslationRecord"("sourceHash");

-- CreateIndex
CREATE UNIQUE INDEX "TranslationRecord_entityType_entityId_field_sourceLocale_ta_key" ON "TranslationRecord"("entityType", "entityId", "field", "sourceLocale", "targetLocale");

-- CreateIndex
CREATE INDEX "AiUsageEvent_operation_createdAt_idx" ON "AiUsageEvent"("operation", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_provider_createdAt_idx" ON "AiUsageEvent"("provider", "createdAt");

-- CreateIndex
CREATE INDEX "AiUsageEvent_entityType_entityId_idx" ON "AiUsageEvent"("entityType", "entityId");
