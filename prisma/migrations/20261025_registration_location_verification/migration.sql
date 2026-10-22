ALTER TABLE "User"
  ADD COLUMN "fullName" TEXT,
  ADD COLUMN "fullAddress" TEXT,
  ADD COLUMN "streetAddress" TEXT,
  ADD COLUMN "barangay" TEXT,
  ADD COLUMN "cityMunicipality" TEXT,
  ADD COLUMN "province" TEXT,
  ADD COLUMN "postalCode" TEXT,
  ADD COLUMN "country" TEXT,
  ADD COLUMN "locationVerificationStatus" TEXT,
  ADD COLUMN "locationVerifiedAt" TIMESTAMP(3);

CREATE TABLE "RegistrationLocationVerification" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "email" TEXT NOT NULL,
  "fullAddress" TEXT NOT NULL,
  "streetAddress" TEXT,
  "barangay" TEXT,
  "cityMunicipality" TEXT,
  "postalCode" TEXT,
  "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3) NOT NULL
);

CREATE INDEX "RegistrationLocationVerification_expiresAt_idx"
  ON "RegistrationLocationVerification"("expiresAt");
