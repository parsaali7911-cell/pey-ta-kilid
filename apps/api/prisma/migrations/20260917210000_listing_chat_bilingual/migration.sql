-- AlterTable
ALTER TABLE "ListingChatThread" ADD COLUMN IF NOT EXISTS "buyerLocale" TEXT;

ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "bodyFa" TEXT;
ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "bodyForBuyer" TEXT;
ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "sourceLang" TEXT;
