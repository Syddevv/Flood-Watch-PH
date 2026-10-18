-- Additive migration. Existing flood reports, including "Rescue Needed", are unchanged.
CREATE TABLE "RescueRequest" (
  "id" TEXT NOT NULL,
  "reference" TEXT NOT NULL,
  "requesterUserId" TEXT,
  "creatorUserId" TEXT NOT NULL,
  "intakeChannel" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "idempotencyHash" TEXT NOT NULL,
  "forWhom" TEXT NOT NULL,
  "assistedPersonName" TEXT,
  "relationship" TEXT,
  "primaryContact" TEXT NOT NULL,
  "alternateContact" TEXT,
  "peopleCount" INTEGER NOT NULL,
  "vulnerabilityTags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "vulnerabilityNotes" TEXT,
  "description" TEXT NOT NULL,
  "locationName" TEXT NOT NULL,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "locationUncertainty" TEXT NOT NULL,
  "localityCode" TEXT NOT NULL,
  "barangay" TEXT NOT NULL,
  "linkedReportId" TEXT,
  "linkedReportConsentConfirmedAt" TIMESTAMP(3),
  "priority" TEXT NOT NULL DEFAULT 'routine',
  "status" TEXT NOT NULL DEFAULT 'received',
  "caseOwnerUserId" TEXT,
  "confirmedTeamReference" TEXT,
  "outcome" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RescueRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RescueRequest_peopleCount_chk" CHECK ("peopleCount" BETWEEN 1 AND 1000),
  CONSTRAINT "RescueRequest_status_chk" CHECK ("status" IN ('received','triaged','assigned','en_route','on_scene','completed','cancelled','rejected')),
  CONSTRAINT "RescueRequest_priority_chk" CHECK ("priority" IN ('routine','urgent','critical')),
  CONSTRAINT "RescueRequest_channel_chk" CHECK ("intakeChannel" IN ('public','admin_assisted')),
  CONSTRAINT "RescueRequest_locationUncertainty_chk" CHECK ("locationUncertainty" IN ('gps','map','manual'))
);
CREATE TABLE "RescueRequestEvent" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "previousStatus" TEXT,
  "nextStatus" TEXT,
  "previousPriority" TEXT,
  "nextPriority" TEXT,
  "previousCaseOwnerUserId" TEXT,
  "nextCaseOwnerUserId" TEXT,
  "visibility" TEXT NOT NULL,
  "reason" TEXT,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RescueRequestEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RescueRequestEvent_visibility_chk" CHECK ("visibility" IN ('public','internal'))
);
CREATE UNIQUE INDEX "RescueRequest_reference_key" ON "RescueRequest"("reference");
CREATE UNIQUE INDEX "RescueRequest_creatorUserId_intakeChannel_idempotencyKey_key" ON "RescueRequest"("creatorUserId","intakeChannel","idempotencyKey");
CREATE INDEX "RescueRequest_requesterUserId_createdAt_id_idx" ON "RescueRequest"("requesterUserId","createdAt","id");
CREATE INDEX "RescueRequest_status_priority_updatedAt_idx" ON "RescueRequest"("status","priority","updatedAt");
CREATE INDEX "RescueRequest_localityCode_status_idx" ON "RescueRequest"("localityCode","status");
CREATE INDEX "RescueRequest_caseOwnerUserId_status_idx" ON "RescueRequest"("caseOwnerUserId","status");
CREATE INDEX "RescueRequest_primaryContact_createdAt_idx" ON "RescueRequest"("primaryContact","createdAt");
CREATE INDEX "RescueRequestEvent_requestId_createdAt_id_idx" ON "RescueRequestEvent"("requestId","createdAt","id");
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_requesterUserId_fkey" FOREIGN KEY ("requesterUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_caseOwnerUserId_fkey" FOREIGN KEY ("caseOwnerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_linkedReportId_fkey" FOREIGN KEY ("linkedReportId") REFERENCES "FloodReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RescueRequestEvent" ADD CONSTRAINT "RescueRequestEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RescueRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescueRequestEvent" ADD CONSTRAINT "RescueRequestEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
