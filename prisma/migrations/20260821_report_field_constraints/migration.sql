-- Enforce the report vocabulary at the database boundary. These constraints
-- include legacy lifecycle spellings still accepted by the application.
ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_severity_allowed_chk"
CHECK ("severity" IN ('Low', 'Moderate', 'High', 'Critical')) NOT VALID;

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_status_allowed_chk"
CHECK ("status" IN (
  'Needs More Confirmation',
  'Confirmed by Community',
  'Likely Receded',
  'Resolved',
  'Archived',
  'active',
  'receded',
  'resolved',
  'Active',
  'Monitoring',
  'Likely Resolved'
)) NOT VALID;

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_sourceType_allowed_chk"
CHECK ("sourceType" IN ('Community', 'Official', 'System')) NOT VALID;

ALTER TABLE "ReportConfirmation"
ADD CONSTRAINT "ReportConfirmation_type_allowed_chk"
CHECK ("confirmationType" IN ('still_active', 'confirmed', 'resolved')) NOT VALID;

ALTER TABLE "ReportUpdate"
ADD CONSTRAINT "ReportUpdate_severity_allowed_chk"
CHECK ("severity" IS NULL OR "severity" IN ('Low', 'Moderate', 'High', 'Critical')) NOT VALID;

ALTER TABLE "ReportUpdate"
ADD CONSTRAINT "ReportUpdate_status_allowed_chk"
CHECK ("status" IS NULL OR "status" IN (
  'Needs More Confirmation',
  'Confirmed by Community',
  'Likely Receded',
  'Resolved',
  'Archived',
  'active',
  'receded',
  'resolved',
  'Active',
  'Monitoring',
  'Likely Resolved'
)) NOT VALID;
