-- Project procurement workspace (context layer on marketplace)

CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "ProjectStageStatus" AS ENUM ('PLANNED', 'ACTIVE', 'DONE', 'SKIPPED');
CREATE TYPE "ProjectMemberRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
CREATE TYPE "ProjectRequirementKind" AS ENUM ('PRODUCT', 'SERVICE');
CREATE TYPE "ProjectRequirementStatus" AS ENUM ('PLANNED', 'SOURCING', 'RFQ_OPEN', 'ORDERED', 'FULFILLED', 'CANCELLED');
CREATE TYPE "ProjectRequirementSource" AS ENUM ('MANUAL', 'STAGE_TEMPLATE', 'AI_SUGGESTION');
CREATE TYPE "ProjectLeadTimeSource" AS ENUM ('NONE', 'LISTING', 'QUOTE', 'MANUAL_ESTIMATE');

CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "ownerOrganizationId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "projectTypeCode" TEXT,
    "areaM2" DECIMAL(18,3),
    "startDate" TIMESTAMP(3),
    "estimatedCompletionDate" TIMESTAMP(3),
    "currentStageCode" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "addressId" TEXT,
    "geoPointId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Project_publicId_key" ON "Project"("publicId");
CREATE INDEX "Project_ownerOrganizationId_status_idx" ON "Project"("ownerOrganizationId", "status");
CREATE INDEX "Project_createdByUserId_idx" ON "Project"("createdByUserId");
CREATE INDEX "Project_currentStageCode_idx" ON "Project"("currentStageCode");

ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerOrganizationId_fkey" FOREIGN KEY ("ownerOrganizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Project" ADD CONSTRAINT "Project_geoPointId_fkey" FOREIGN KEY ("geoPointId") REFERENCES "GeoPoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "ProjectMemberRole" NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectStage" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageCode" TEXT NOT NULL,
    "sortOrder" INT NOT NULL DEFAULT 0,
    "status" "ProjectStageStatus" NOT NULL DEFAULT 'PLANNED',
    "progressPct" INT NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectStage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectStage_projectId_stageCode_key" ON "ProjectStage"("projectId", "stageCode");
CREATE INDEX "ProjectStage_projectId_sortOrder_idx" ON "ProjectStage"("projectId", "sortOrder");
ALTER TABLE "ProjectStage" ADD CONSTRAINT "ProjectStage_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ProjectRequirement" (
    "id" TEXT NOT NULL,
    "publicId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "stageCode" TEXT,
    "kind" "ProjectRequirementKind" NOT NULL DEFAULT 'PRODUCT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "specialtyCode" TEXT,
    "quantity" DECIMAL(18,3),
    "uomCode" TEXT,
    "needByDate" TIMESTAMP(3),
    "procurementTargetDate" TIMESTAMP(3),
    "verifiedLeadTimeDays" INT,
    "leadTimeSource" "ProjectLeadTimeSource" NOT NULL DEFAULT 'NONE',
    "status" "ProjectRequirementStatus" NOT NULL DEFAULT 'PLANNED',
    "source" "ProjectRequirementSource" NOT NULL DEFAULT 'MANUAL',
    "listingId" TEXT,
    "rfqId" TEXT,
    "quoteId" TEXT,
    "orderId" TEXT,
    "professionalLeadId" TEXT,
    "sortOrder" INT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProjectRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProjectRequirement_publicId_key" ON "ProjectRequirement"("publicId");
CREATE UNIQUE INDEX "ProjectRequirement_professionalLeadId_key" ON "ProjectRequirement"("professionalLeadId");
CREATE INDEX "ProjectRequirement_projectId_status_idx" ON "ProjectRequirement"("projectId", "status");
CREATE INDEX "ProjectRequirement_projectId_stageCode_idx" ON "ProjectRequirement"("projectId", "stageCode");
CREATE INDEX "ProjectRequirement_listingId_idx" ON "ProjectRequirement"("listingId");
CREATE INDEX "ProjectRequirement_rfqId_idx" ON "ProjectRequirement"("rfqId");
CREATE INDEX "ProjectRequirement_quoteId_idx" ON "ProjectRequirement"("quoteId");
CREATE INDEX "ProjectRequirement_orderId_idx" ON "ProjectRequirement"("orderId");
CREATE INDEX "ProjectRequirement_categoryId_idx" ON "ProjectRequirement"("categoryId");

ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProjectRequirement" ADD CONSTRAINT "ProjectRequirement_professionalLeadId_fkey" FOREIGN KEY ("professionalLeadId") REFERENCES "ProfessionalLead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MediaAsset" ADD COLUMN "projectId" TEXT;
CREATE INDEX "MediaAsset_projectId_idx" ON "MediaAsset"("projectId");
ALTER TABLE "MediaAsset" ADD CONSTRAINT "MediaAsset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Rfq" ADD COLUMN "projectId" TEXT;
ALTER TABLE "Rfq" ADD COLUMN "projectRequirementId" TEXT;
CREATE INDEX "Rfq_projectId_idx" ON "Rfq"("projectId");
CREATE INDEX "Rfq_projectRequirementId_idx" ON "Rfq"("projectRequirementId");
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_projectRequirementId_fkey" FOREIGN KEY ("projectRequirementId") REFERENCES "ProjectRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProfessionalLead" ADD COLUMN "projectId" TEXT;
ALTER TABLE "ProfessionalLead" ADD COLUMN "projectRequirementId" TEXT;
CREATE INDEX "ProfessionalLead_projectId_idx" ON "ProfessionalLead"("projectId");
CREATE INDEX "ProfessionalLead_projectRequirementId_idx" ON "ProfessionalLead"("projectRequirementId");
ALTER TABLE "ProfessionalLead" ADD CONSTRAINT "ProfessionalLead_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ProfessionalLead" ADD CONSTRAINT "ProfessionalLead_projectRequirementId_fkey" FOREIGN KEY ("projectRequirementId") REFERENCES "ProjectRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
