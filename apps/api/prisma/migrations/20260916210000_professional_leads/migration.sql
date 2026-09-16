-- CreateEnum
CREATE TYPE "ProfessionalLeadStatus" AS ENUM ('OPEN', 'MATCHED', 'CLOSED');

-- CreateTable
CREATE TABLE "ProfessionalLead" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'fa',
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "specialtyHints" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "city" TEXT,
    "countryCode" TEXT,
    "notes" TEXT,
    "sourceText" TEXT,
    "status" "ProfessionalLeadStatus" NOT NULL DEFAULT 'OPEN',
    "matchedOrganizationId" TEXT,
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfessionalLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProfessionalLead_publicId_key" ON "ProfessionalLead"("publicId");

-- CreateIndex
CREATE INDEX "ProfessionalLead_status_createdAt_idx" ON "ProfessionalLead"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfessionalLead_matchedOrganizationId_idx" ON "ProfessionalLead"("matchedOrganizationId");

-- CreateIndex
CREATE INDEX "ProfessionalLead_city_idx" ON "ProfessionalLead"("city");

-- AddForeignKey
ALTER TABLE "ProfessionalLead" ADD CONSTRAINT "ProfessionalLead_matchedOrganizationId_fkey" FOREIGN KEY ("matchedOrganizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
