ALTER TABLE "EvacuationCenter"
ADD COLUMN "availabilityConfirmedAt" TIMESTAMP(3);

ALTER TABLE "EvacuationCenter"
ALTER COLUMN "status" SET DEFAULT 'needs_verification';

UPDATE "EvacuationCenter"
SET "status" = 'needs_verification'
WHERE lower("status") IN ('unknown', 'open');

UPDATE "EvacuationCenter"
SET "status" = 'standby'
WHERE lower("status") = 'standby';

UPDATE "EvacuationCenter"
SET "isArchived" = true,
    "archivedAt" = CURRENT_TIMESTAMP
WHERE lower(trim("province")) <> 'bulacan'
  AND "isArchived" = false;
