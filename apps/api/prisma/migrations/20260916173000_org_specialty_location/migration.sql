-- Persist trade specialty on organizations for directory / demand matching
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "primarySpecialty" TEXT;
CREATE INDEX IF NOT EXISTS "Organization_isProfessional_isActive_idx" ON "Organization"("isProfessional", "isActive");
CREATE INDEX IF NOT EXISTS "Organization_primarySpecialty_idx" ON "Organization"("primarySpecialty");
