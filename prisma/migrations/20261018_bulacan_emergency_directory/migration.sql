-- Expand only: preserve all existing center/contact rows and operational updates.
ALTER TABLE "EvacuationCenter"
  ALTER COLUMN "latitude" DROP NOT NULL,
  ALTER COLUMN "longitude" DROP NOT NULL,
  ADD COLUMN "externalKey" TEXT,
  ADD COLUMN "sourceSnapshot" JSONB,
  ADD COLUMN "sourceCheckedAt" TIMESTAMP(3),
  ADD COLUMN "facilityType" TEXT,
  ADD COLUMN "permanent" BOOLEAN,
  ADD COLUMN "capacityFamilies" INTEGER,
  ADD COLUMN "lastDocumentedEventDate" TIMESTAMP(3),
  ADD COLUMN "currentOccupancy" INTEGER,
  ADD COLUMN "currentCapacity" INTEGER,
  ADD COLUMN "adminEvidenceUrl" TEXT,
  ADD COLUMN "duplicateReviewNotes" TEXT;

CREATE UNIQUE INDEX "EvacuationCenter_externalKey_key" ON "EvacuationCenter"("externalKey");

ALTER TABLE "EmergencyContact"
  ADD COLUMN "sourceSnapshot" JSONB,
  ADD COLUMN "phones" JSONB,
  ADD COLUMN "sourceFreshness" TEXT,
  ADD COLUMN "preferred" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "updatedByUserId" TEXT,
  ADD COLUMN "adminEvidenceUrl" TEXT,
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "duplicateReviewNotes" TEXT;
