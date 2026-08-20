-- Add indexes for report filtering, ordering, lifecycle reads, and nearby lookups.
CREATE INDEX "FloodReport_status_createdAt_idx"
  ON "FloodReport" ("status", "createdAt");

CREATE INDEX "FloodReport_severity_createdAt_idx"
  ON "FloodReport" ("severity", "createdAt");

CREATE INDEX "FloodReport_category_createdAt_idx"
  ON "FloodReport" ("category", "createdAt");

CREATE INDEX "FloodReport_sourceType_createdAt_idx"
  ON "FloodReport" ("sourceType", "createdAt");

CREATE INDEX "FloodReport_lastActivityAt_idx"
  ON "FloodReport" ("lastActivityAt");

CREATE INDEX "FloodReport_latitude_longitude_idx"
  ON "FloodReport" ("latitude", "longitude");

CREATE INDEX "ReportConfirmation_reportId_confirmationType_createdAt_idx"
  ON "ReportConfirmation" ("reportId", "confirmationType", "createdAt");
