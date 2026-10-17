-- Phase U3 expands authentication without changing or deleting existing
-- users, passwords, sessions, reports, or administrator relationships.
-- Existing users enter an explicit temporary review state; new users default
-- to pending and cannot authenticate until their email is verified.

ALTER TABLE "User"
ADD COLUMN "emailVerificationStatus" TEXT,
ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);

UPDATE "User"
SET "emailVerificationStatus" = CASE
  WHEN "role" = 'admin' THEN 'legacy_admin_review'
  ELSE 'legacy_grace'
END;

ALTER TABLE "User"
ALTER COLUMN "emailVerificationStatus" SET NOT NULL,
ALTER COLUMN "emailVerificationStatus" SET DEFAULT 'pending';

ALTER TABLE "User"
ADD CONSTRAINT "User_emailVerificationStatus_allowed_chk"
CHECK (
  "emailVerificationStatus" IN (
    'pending',
    'verified',
    'legacy_grace',
    'legacy_admin_review'
  )
) NOT VALID;

CREATE INDEX "User_emailVerificationStatus_idx"
ON "User"("emailVerificationStatus");

CREATE TABLE "EmailVerification" (
  "id"                      TEXT NOT NULL,
  "userId"                  TEXT NOT NULL,
  "codeHash"                TEXT NOT NULL,
  "keyId"                   TEXT NOT NULL,
  "expiresAt"               TIMESTAMP(3) NOT NULL,
  "attemptCount"            INTEGER NOT NULL DEFAULT 0,
  "resendAvailableAt"       TIMESTAMP(3) NOT NULL,
  "consumedAt"              TIMESTAMP(3),
  "version"                 INTEGER NOT NULL DEFAULT 1,
  "providerMessageId"       TEXT,
  "deliveryStatus"          TEXT NOT NULL DEFAULT 'pending',
  "lastDeliveryAttemptAt"   TIMESTAMP(3),
  "lastDeliverySucceededAt" TIMESTAMP(3),
  "lastDeliveryErrorCode"   TEXT,
  "createdAt"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"               TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailVerification_userId_key"
ON "EmailVerification"("userId");
CREATE INDEX "EmailVerification_expiresAt_idx"
ON "EmailVerification"("expiresAt");
CREATE INDEX "EmailVerification_consumedAt_idx"
ON "EmailVerification"("consumedAt");
CREATE INDEX "EmailVerification_providerMessageId_idx"
ON "EmailVerification"("providerMessageId");

ALTER TABLE "EmailVerification"
ADD CONSTRAINT "EmailVerification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailVerification"
ADD CONSTRAINT "EmailVerification_attemptCount_nonnegative_chk"
CHECK ("attemptCount" >= 0) NOT VALID;

ALTER TABLE "EmailVerification"
ADD CONSTRAINT "EmailVerification_deliveryStatus_allowed_chk"
CHECK ("deliveryStatus" IN ('pending', 'sent', 'delivered', 'bounced', 'failed')) NOT VALID;
