-- Allow sourced directory facilities without claiming operational verification.
-- Retain every previously accepted value for mixed-version application writes.
ALTER TABLE "EvacuationCenter"
  DROP CONSTRAINT "EvacuationCenter_verificationStatus_allowed_chk",
  ADD CONSTRAINT "EvacuationCenter_verificationStatus_allowed_chk"
  CHECK ("verificationStatus" IN (
    'verified',
    'official_publication_found',
    'needs_verification',
    'outdated',
    'disputed'
  )) NOT VALID;
