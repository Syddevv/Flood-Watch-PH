-- Report capture metadata (Priority 4, roadmap item 7).
--
-- Records how a report's coordinates were obtained and, for GPS fixes, how
-- accurate the device claimed to be. Until now a +/-5 m GPS fix and a
-- hand-typed guess were indistinguishable once stored.
--
-- Additive and backfill-safe. Existing reports predate provenance tracking,
-- so they become 'manual' with a NULL accuracy: the honest reading is that
-- their provenance is unknown, not that somebody typed them.
--
-- "photoCapturedAt" is the one client-supplied timestamp in the schema. It is
-- descriptive metadata about the attached image, clamped server-side to a
-- sane window, and never an authority on when the report was filed - that
-- remains "createdAt".

ALTER TABLE "FloodReport"
ADD COLUMN "locationSource" TEXT,
ADD COLUMN "gpsAccuracyMeters" DOUBLE PRECISION,
ADD COLUMN "photoCapturedAt" TIMESTAMP(3);

UPDATE "FloodReport"
SET "locationSource" = 'manual'
WHERE "locationSource" IS NULL;

ALTER TABLE "FloodReport"
ALTER COLUMN "locationSource" SET NOT NULL,
ALTER COLUMN "locationSource" SET DEFAULT 'manual';

CREATE INDEX "FloodReport_locationSource_idx" ON "FloodReport"("locationSource");

-- Vocabulary guard at the database boundary, matching the convention in
-- 20260821_report_field_constraints. NOT VALID skips the scan of existing
-- rows; the backfill above already guarantees they satisfy it.
ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_locationSource_allowed_chk"
CHECK ("locationSource" IN ('gps', 'map', 'search', 'manual')) NOT VALID;

-- Accuracy only ever accompanies a GPS fix, and only as a positive distance.
-- The application drops out-of-range values; this makes the rule structural.
ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_gpsAccuracyMeters_range_chk"
CHECK (
  "gpsAccuracyMeters" IS NULL
  OR ("locationSource" = 'gps' AND "gpsAccuracyMeters" > 0 AND "gpsAccuracyMeters" <= 100000)
) NOT VALID;
