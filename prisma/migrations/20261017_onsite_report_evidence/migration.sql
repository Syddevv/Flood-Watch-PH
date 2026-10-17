-- U2 onsite report evidence. Existing reports remain legacy records because
-- every new column is nullable and no eligibility value is backfilled.
ALTER TABLE "FloodReport"
ADD COLUMN "gpsLatitude" DOUBLE PRECISION,
ADD COLUMN "gpsLongitude" DOUBLE PRECISION,
ADD COLUMN "gpsCapturedAt" TIMESTAMP(3),
ADD COLUMN "onsitePolicyVersion" TEXT,
ADD COLUMN "onsiteEligibleAt" TIMESTAMP(3);

-- GPS accuracy now describes the separately stored fix even when a user moves
-- the public report pin by map/search/manual input. All four fix fields must be
-- present together; admins and legacy rows retain all-null evidence.
ALTER TABLE "FloodReport" DROP CONSTRAINT "FloodReport_gpsAccuracyMeters_range_chk";
ALTER TABLE "FloodReport" ADD CONSTRAINT "FloodReport_onsiteGpsEvidence_complete_chk"
CHECK (
  (
    "onsitePolicyVersion" IS NULL
    AND "gpsLatitude" IS NULL
    AND "gpsLongitude" IS NULL
    AND "gpsCapturedAt" IS NULL
    AND (
      "gpsAccuracyMeters" IS NULL
      OR (
        "locationSource" = 'gps'
        AND "gpsAccuracyMeters" > 0
        AND "gpsAccuracyMeters" <= 100000
      )
    )
  )
  OR
  (
    "onsitePolicyVersion" IS NOT NULL
    AND "gpsLatitude" IS NOT NULL
    AND "gpsLatitude" BETWEEN -90 AND 90
    AND "gpsLongitude" IS NOT NULL
    AND "gpsLongitude" BETWEEN -180 AND 180
    AND "gpsCapturedAt" IS NOT NULL
    AND "gpsAccuracyMeters" IS NOT NULL
    AND "gpsAccuracyMeters" > 0
    AND "gpsAccuracyMeters" <= 100
  )
);

ALTER TABLE "FloodReport" ADD CONSTRAINT "FloodReport_onsiteEligibility_complete_chk"
CHECK (
  ("onsitePolicyVersion" IS NULL AND "onsiteEligibleAt" IS NULL)
  OR
  (
    "onsitePolicyVersion" IS NOT NULL
    AND "onsiteEligibleAt" IS NOT NULL
    AND "imageUrl" IS NOT NULL
    AND "photoCapturedAt" IS NOT NULL
    AND "gpsCapturedAt" IS NOT NULL
  )
);

CREATE INDEX "FloodReport_onsitePolicyVersion_idx" ON "FloodReport"("onsitePolicyVersion");
