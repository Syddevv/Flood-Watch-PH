-- Preserve every historical status and event. Only expand allowed values and add
-- nullable action identifiers for replay-safe Phase 3 lifecycle writes.
ALTER TABLE "RescueRequest" DROP CONSTRAINT "RescueRequest_status_chk";
ALTER TABLE "RescueRequest" ADD CONSTRAINT "RescueRequest_status_chk" CHECK (
  "status" IN (
    'received','under_review','awaiting_responder','responder_confirmed','dispatched',
    'en_route','on_scene','resolved','closed','cancelled','duplicate','referred',
    'unable_to_contact','triaged','assigned','completed','rejected'
  )
);

ALTER TABLE "RescueRequestEvent"
  ADD COLUMN "actionKey" TEXT,
  ADD COLUMN "actionHash" TEXT;
CREATE UNIQUE INDEX "RescueRequestEvent_requestId_actionKey_key"
  ON "RescueRequestEvent"("requestId", "actionKey");
