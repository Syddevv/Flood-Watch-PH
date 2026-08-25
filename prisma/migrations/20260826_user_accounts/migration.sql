-- Introduce authenticated user accounts and DB-backed sessions. Purely
-- additive: no existing FloodReport row is touched. New reports get
-- userId; existing reports keep ownerSessionHash and userId = null
-- forever (both are nullable, checked in application code as
-- mutually exclusive going forward).

CREATE TABLE "User" (
  "id"           TEXT NOT NULL,
  "email"        TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName"  TEXT,
  "role"         TEXT NOT NULL DEFAULT 'user',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,

  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "User_email_key" ON "User" ("email");
CREATE INDEX "User_role_idx" ON "User" ("role");

ALTER TABLE "User"
ADD CONSTRAINT "User_role_allowed_chk"
CHECK ("role" IN ('user', 'admin')) NOT VALID;

CREATE TABLE "Session" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "tokenHash"  TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session" ("tokenHash");
CREATE INDEX "Session_userId_idx" ON "Session" ("userId");
CREATE INDEX "Session_expiresAt_idx" ON "Session" ("expiresAt");

ALTER TABLE "Session"
ADD CONSTRAINT "Session_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FloodReport" ADD COLUMN "userId" TEXT;

CREATE INDEX "FloodReport_userId_idx" ON "FloodReport" ("userId");

ALTER TABLE "FloodReport"
ADD CONSTRAINT "FloodReport_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
