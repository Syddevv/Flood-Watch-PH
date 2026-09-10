ALTER TABLE "EvacuationCenter" ADD COLUMN "updatedByUserId" TEXT;

CREATE TABLE "AdminOperationalAction" (
  "id" TEXT NOT NULL,
  "targetType" TEXT NOT NULL,
  "targetId" TEXT NOT NULL,
  "actionType" TEXT NOT NULL,
  "previousValue" TEXT,
  "nextValue" TEXT,
  "visibility" TEXT NOT NULL DEFAULT 'internal',
  "note" TEXT,
  "actorUserId" TEXT,
  "requestId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminOperationalAction_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AdminOperationalAction_targetType_targetId_createdAt_idx" ON "AdminOperationalAction" ("targetType", "targetId", "createdAt");
CREATE INDEX "AdminOperationalAction_actorUserId_createdAt_idx" ON "AdminOperationalAction" ("actorUserId", "createdAt");
CREATE INDEX "AdminOperationalAction_actionType_createdAt_idx" ON "AdminOperationalAction" ("actionType", "createdAt");

CREATE TABLE "AdminNotification" (
  "id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "detail" TEXT NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "priority" TEXT NOT NULL DEFAULT 'normal',
  "recipientUserId" TEXT,
  "dedupeKey" TEXT,
  "readAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AdminNotification_recipientUserId_dedupeKey_key" ON "AdminNotification" ("recipientUserId", "dedupeKey");
CREATE INDEX "AdminNotification_recipientUserId_readAt_createdAt_idx" ON "AdminNotification" ("recipientUserId", "readAt", "createdAt");
CREATE INDEX "AdminNotification_priority_createdAt_idx" ON "AdminNotification" ("priority", "createdAt");
CREATE INDEX "AdminNotification_targetType_targetId_idx" ON "AdminNotification" ("targetType", "targetId");

CREATE TABLE "AdminSetting" (
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedByUserId" TEXT,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSetting_pkey" PRIMARY KEY ("key")
);

ALTER TABLE "AdminOperationalAction" ADD CONSTRAINT "AdminOperationalAction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminOperationalAction" ADD CONSTRAINT "AdminOperationalAction_actionType_allowed_chk" CHECK ("actionType" IN ('status_change','verification','note','assignment','resolution')) NOT VALID;
ALTER TABLE "AdminOperationalAction" ADD CONSTRAINT "AdminOperationalAction_visibility_allowed_chk" CHECK ("visibility" IN ('internal','public')) NOT VALID;
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_priority_allowed_chk" CHECK ("priority" IN ('normal','urgent','emergency')) NOT VALID;
