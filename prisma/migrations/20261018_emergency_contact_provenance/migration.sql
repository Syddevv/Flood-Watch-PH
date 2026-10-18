ALTER TABLE "EmergencyContact"
ADD COLUMN "sourceKey" TEXT,
ADD COLUMN "sourceUrl" TEXT,
ADD COLUMN "lastSourceCheckedAt" TIMESTAMP(3),
ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'needs_verification',
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "category" TEXT NOT NULL DEFAULT 'Local Response';

CREATE UNIQUE INDEX "EmergencyContact_sourceKey_key" ON "EmergencyContact"("sourceKey");
CREATE INDEX "EmergencyContact_verificationStatus_isArchived_idx" ON "EmergencyContact"("verificationStatus", "isArchived");
CREATE INDEX "EmergencyContact_province_city_idx" ON "EmergencyContact"("province", "city");
