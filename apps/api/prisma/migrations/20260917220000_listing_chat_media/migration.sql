-- AlterTable
ALTER TABLE "ListingChatMessage" ALTER COLUMN "body" SET DEFAULT '';
ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "mediaUrl" TEXT;
ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "mediaType" TEXT;
ALTER TABLE "ListingChatMessage" ADD COLUMN IF NOT EXISTS "mediaMime" TEXT;
