-- Additive review provenance. Existing reports retain their current state;
-- no historical review decision is invented.
ALTER TABLE "FloodReport"
ADD COLUMN "reviewVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "reviewedAt" TIMESTAMP(3),
ADD COLUMN "reviewedByUserId" TEXT,
ADD COLUMN "reviewPublicMessage" TEXT;

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_reviewVersion_positive_chk"
CHECK ("reviewVersion" >= 1) NOT VALID;
