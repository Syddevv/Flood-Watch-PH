ALTER TABLE "FloodReport"
ALTER COLUMN "status" SET DEFAULT 'Needs More Confirmation';

ALTER TABLE "FloodReport"
ADD COLUMN "lastActivityAt" TIMESTAMP(3),
ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "FloodReport"
SET "lastActivityAt" = COALESCE("updatedAt", "createdAt")
WHERE "lastActivityAt" IS NULL;

ALTER TABLE "FloodReport"
ALTER COLUMN "lastActivityAt" SET NOT NULL,
ALTER COLUMN "lastActivityAt" SET DEFAULT CURRENT_TIMESTAMP;
