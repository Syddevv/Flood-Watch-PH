-- Introduce a first-class Incident abstraction that groups FloodReport rows
-- representing the same physical flooding situation. Every existing report
-- is backfilled into its own new incident; no report is deleted, merged, or
-- reassigned without an explicit incidentId link.

CREATE TABLE "Incident" (
  "id"                      TEXT NOT NULL,
  "status"                  TEXT NOT NULL DEFAULT 'Needs More Confirmation',
  "representativeLatitude"  DOUBLE PRECISION NOT NULL,
  "representativeLongitude" DOUBLE PRECISION NOT NULL,
  "locationName"            TEXT NOT NULL,
  "severity"                TEXT NOT NULL,
  "reportCount"             INTEGER NOT NULL DEFAULT 1,
  "firstReportAt"           TIMESTAMP(3) NOT NULL,
  "lastActivityAt"          TIMESTAMP(3) NOT NULL,
  "resolvedAt"              TIMESTAMP(3),
  "archivedAt"              TIMESTAMP(3),
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Incident_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "FloodReport" ADD COLUMN "incidentId" TEXT;

-- Backfill: every existing report becomes the sole founding member of its
-- own new incident, preserving current status/severity/location/timestamps.
-- Deterministic id derived from the report id (no SQL-side cuid generator
-- needed, trivially unique, and human-traceable to its founding report).
INSERT INTO "Incident" (
  "id", "status", "representativeLatitude", "representativeLongitude",
  "locationName", "severity", "reportCount", "firstReportAt", "lastActivityAt",
  "resolvedAt", "archivedAt", "createdAt", "updatedAt"
)
SELECT
  'incident_' || fr."id", fr."status", fr."latitude", fr."longitude",
  fr."locationName", fr."severity", 1, fr."createdAt", fr."lastActivityAt",
  fr."resolvedAt", fr."archivedAt", fr."createdAt", fr."updatedAt"
FROM "FloodReport" fr;

UPDATE "FloodReport" fr SET "incidentId" = 'incident_' || fr."id";

ALTER TABLE "FloodReport" ALTER COLUMN "incidentId" SET NOT NULL;

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_incidentId_fkey"
FOREIGN KEY ("incidentId") REFERENCES "Incident"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "FloodReport_incidentId_idx" ON "FloodReport" ("incidentId");

CREATE INDEX "Incident_status_lastActivityAt_idx"
  ON "Incident" ("status", "lastActivityAt");

CREATE INDEX "Incident_representativeLatitude_representativeLongitude_idx"
  ON "Incident" ("representativeLatitude", "representativeLongitude");

-- Reuse the exact same allowed-status vocabulary as FloodReport_status_allowed_chk
-- (including legacy spellings), since this backfill copies fr.status verbatim
-- and that column already permits those legacy values. NOT VALID (consistent
-- with the 20260821 migration's precedent) so backfilled rows are never
-- retroactively scanned/rejected; only future writes are checked.
ALTER TABLE "Incident"
ADD CONSTRAINT "Incident_status_allowed_chk"
CHECK ("status" IN (
  'Needs More Confirmation', 'Confirmed by Community', 'Likely Receded',
  'Resolved', 'Archived', 'active', 'receded', 'resolved', 'Active',
  'Monitoring', 'Likely Resolved'
)) NOT VALID;
