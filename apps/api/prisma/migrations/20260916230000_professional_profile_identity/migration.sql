-- Professional identity profile, OTP, portfolio, reviews
CREATE TYPE "ProfessionalReviewStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'HIDDEN');

CREATE TABLE "ProfessionalProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "displayName" TEXT,
    "bio" TEXT,
    "yearsExperience" INTEGER,
    "mobilePhone" TEXT,
    "mobileVerifiedAt" TIMESTAMP(3),
    "nationalIdHash" TEXT,
    "nationalIdLast4" TEXT,
    "nationalIdVerifiedAt" TIMESTAMP(3),
    "identityVerifiedAt" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "secondarySpecialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "projectTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceRadiusKm" DOUBLE PRECISION,
    "priceRangeMin" DECIMAL(18,2),
    "priceRangeMax" DECIMAL(18,2),
    "priceCurrency" TEXT DEFAULT 'IRR',
    "priceNote" TEXT,
    "availabilityNote" TEXT,
    "profileScore" INTEGER NOT NULL DEFAULT 0,
    "portfolioCount" INTEGER NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "ratingAvg" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalProfile_organizationId_key" ON "ProfessionalProfile"("organizationId");
CREATE INDEX "ProfessionalProfile_profileScore_idx" ON "ProfessionalProfile"("profileScore");
CREATE INDEX "ProfessionalProfile_mobilePhone_idx" ON "ProfessionalProfile"("mobilePhone");
CREATE INDEX "ProfessionalProfile_identityVerifiedAt_idx" ON "ProfessionalProfile"("identityVerifiedAt");

ALTER TABLE "ProfessionalProfile" ADD CONSTRAINT "ProfessionalProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProfessionalPortfolio" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfessionalPortfolio_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfessionalPortfolio_profileId_idx" ON "ProfessionalPortfolio"("profileId");
ALTER TABLE "ProfessionalPortfolio" ADD CONSTRAINT "ProfessionalPortfolio_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ProfessionalProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProfessionalReview" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "body" TEXT,
    "status" "ProfessionalReviewStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalReview_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfessionalReview_publicId_key" ON "ProfessionalReview"("publicId");
CREATE INDEX "ProfessionalReview_organizationId_status_idx" ON "ProfessionalReview"("organizationId", "status");
CREATE INDEX "ProfessionalReview_authorUserId_idx" ON "ProfessionalReview"("authorUserId");

ALTER TABLE "ProfessionalReview" ADD CONSTRAINT "ProfessionalReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProfessionalReview" ADD CONSTRAINT "ProfessionalReview_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PhoneOtpChallenge" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "organizationId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneOtpChallenge_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PhoneOtpChallenge_phone_purpose_consumedAt_idx" ON "PhoneOtpChallenge"("phone", "purpose", "consumedAt");
CREATE INDEX "PhoneOtpChallenge_organizationId_idx" ON "PhoneOtpChallenge"("organizationId");
