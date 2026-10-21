-- Expand only. Historical rescue rows keep their status, ID and event history.
ALTER TABLE "RescueRequest"
  ADD COLUMN "workflowVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "RescueRequest"
  ADD CONSTRAINT "RescueRequest_workflowVersion_chk" CHECK ("workflowVersion" >= 1);

CREATE TABLE "ResponderOrganization" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "homeLocalityCode" TEXT NOT NULL,
  "coverageLocalityCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "capabilityCodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "contactOffice" TEXT,
  "contactPerson" TEXT,
  "officialPhone" TEXT,
  "secondaryContact" TEXT,
  "preferredChannel" TEXT,
  "availability" TEXT NOT NULL DEFAULT 'unknown',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastContactVerifiedAt" TIMESTAMP(3),
  "demo" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResponderOrganization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ResponderOrganization_availability_chk" CHECK ("availability" IN ('available','busy','unavailable','unknown')),
  CONSTRAINT "ResponderOrganization_homeLocalityCode_chk" CHECK ("homeLocalityCode" ~ '^[0-9]{10}$')
);
CREATE INDEX "ResponderOrganization_name_idx" ON "ResponderOrganization"("name");
CREATE INDEX "ResponderOrganization_homeLocalityCode_active_idx" ON "ResponderOrganization"("homeLocalityCode","active");
CREATE INDEX "ResponderOrganization_availability_active_idx" ON "ResponderOrganization"("availability","active");

CREATE TABLE "RescueAssignment" (
  "id" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "recordedByAdminUserId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'selected',
  "selectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "contactChannel" TEXT,
  "contactOutcome" TEXT,
  "contactDetails" TEXT,
  "contactedAt" TIMESTAMP(3),
  "acknowledgementOutcome" TEXT,
  "acknowledgedAt" TIMESTAMP(3),
  "dispatchConfirmedAt" TIMESTAMP(3),
  "dispatchConfirmedByAdminId" TEXT,
  "dispatchMethod" TEXT,
  "departedAt" TIMESTAMP(3),
  "arrivedAt" TIMESTAMP(3),
  "reportedCompletedAt" TIMESTAMP(3),
  "resolutionDetails" TEXT,
  "endedAt" TIMESTAMP(3),
  "endReason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RescueAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RescueAssignment_status_chk" CHECK ("status" IN ('selected','awaiting_response','accepted','declined','unreachable','unavailable','dispatched','en_route','on_scene','resolved','ended')),
  CONSTRAINT "RescueAssignment_channel_chk" CHECK ("contactChannel" IS NULL OR "contactChannel" IN ('phone','sms_logged','radio','other')),
  CONSTRAINT "RescueAssignment_contactOutcome_chk" CHECK ("contactOutcome" IS NULL OR "contactOutcome" IN ('awaiting_response','accepted','declined','unreachable','unavailable')),
  CONSTRAINT "RescueAssignment_acknowledgementOutcome_chk" CHECK ("acknowledgementOutcome" IS NULL OR "acknowledgementOutcome" IN ('accepted','declined','unreachable','unavailable'))
);
CREATE UNIQUE INDEX "RescueAssignment_one_active_per_request_idx"
  ON "RescueAssignment"("requestId") WHERE "endedAt" IS NULL;
CREATE INDEX "RescueAssignment_requestId_selectedAt_id_idx" ON "RescueAssignment"("requestId","selectedAt","id");
CREATE INDEX "RescueAssignment_organizationId_status_idx" ON "RescueAssignment"("organizationId","status");
CREATE INDEX "RescueAssignment_status_selectedAt_idx" ON "RescueAssignment"("status","selectedAt");
ALTER TABLE "RescueAssignment" ADD CONSTRAINT "RescueAssignment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RescueRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescueAssignment" ADD CONSTRAINT "RescueAssignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "ResponderOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescueAssignment" ADD CONSTRAINT "RescueAssignment_recordedByAdminUserId_fkey" FOREIGN KEY ("recordedByAdminUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RescueAssignment" ADD CONSTRAINT "RescueAssignment_dispatchConfirmedByAdminId_fkey" FOREIGN KEY ("dispatchConfirmedByAdminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RescueRequestEvent"
  ALTER COLUMN "actorUserId" DROP NOT NULL,
  ADD COLUMN "assignmentId" TEXT,
  ADD COLUMN "source" TEXT,
  ADD COLUMN "details" JSONB,
  ADD COLUMN "occurredAt" TIMESTAMP(3);
ALTER TABLE "RescueRequestEvent"
  ADD CONSTRAINT "RescueRequestEvent_source_actor_chk" CHECK (
    ("source" IS NULL AND "actorUserId" IS NOT NULL) OR
    ("source" IN ('citizen','admin') AND "actorUserId" IS NOT NULL) OR
    ("source" = 'system' AND "actorUserId" IS NULL)
  );
CREATE INDEX "RescueRequestEvent_assignmentId_createdAt_idx" ON "RescueRequestEvent"("assignmentId","createdAt");
ALTER TABLE "RescueRequestEvent" ADD CONSTRAINT "RescueRequestEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "RescueAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
