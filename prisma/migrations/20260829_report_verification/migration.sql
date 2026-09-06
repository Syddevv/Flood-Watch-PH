ALTER TABLE "FloodReport" ADD COLUMN "verificationStatus" TEXT NOT NULL DEFAULT 'unreviewed';
ALTER TABLE "FloodReport" ADD CONSTRAINT "FloodReport_verificationStatus_allowed_chk" CHECK ("verificationStatus" IN ('unreviewed', 'verified', 'disputed', 'rejected')) NOT VALID;
CREATE INDEX "FloodReport_verificationStatus_createdAt_idx" ON "FloodReport" ("verificationStatus", "createdAt");
