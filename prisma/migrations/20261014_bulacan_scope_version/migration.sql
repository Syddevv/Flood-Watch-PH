-- Preserve existing records and identify them as created before the Bulacan scope change.
ALTER TABLE "FloodReport" ADD COLUMN "scopeVersion" TEXT;
ALTER TABLE "EvacuationCenter" ADD COLUMN "scopeVersion" TEXT;

UPDATE "FloodReport" SET "scopeVersion" = 'legacy-calumpit-unversioned';
UPDATE "EvacuationCenter" SET "scopeVersion" = 'legacy-calumpit-unversioned';

ALTER TABLE "FloodReport" ALTER COLUMN "scopeVersion" SET NOT NULL;
ALTER TABLE "FloodReport" ALTER COLUMN "scopeVersion" SET DEFAULT 'osm-1504656-2026-10-14';
ALTER TABLE "EvacuationCenter" ALTER COLUMN "scopeVersion" SET NOT NULL;
ALTER TABLE "EvacuationCenter" ALTER COLUMN "scopeVersion" SET DEFAULT 'osm-1504656-2026-10-14';

-- Keep administrator-created report provenance accurate while accepting it at the DB boundary.
ALTER TABLE "FloodReport" DROP CONSTRAINT "FloodReport_locationSource_allowed_chk";
ALTER TABLE "FloodReport" ADD CONSTRAINT "FloodReport_locationSource_allowed_chk"
  CHECK ("locationSource" IN ('gps', 'map', 'search', 'manual', 'admin')) NOT VALID;
ALTER TABLE "FloodReport" VALIDATE CONSTRAINT "FloodReport_locationSource_allowed_chk";
