-- CreateEnum
CREATE TYPE "ChatEscalationStatus" AS ENUM ('NONE', 'OPEN', 'RESOLVED');

-- AlterEnum
ALTER TYPE "ChatSenderRole" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "ListingChatThread" ADD COLUMN IF NOT EXISTS "escalationStatus" "ChatEscalationStatus" NOT NULL DEFAULT 'NONE';
ALTER TABLE "ListingChatThread" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);
ALTER TABLE "ListingChatThread" ADD COLUMN IF NOT EXISTS "escalationReason" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ListingChatThread_escalationStatus_escalatedAt_idx" ON "ListingChatThread"("escalationStatus", "escalatedAt");
