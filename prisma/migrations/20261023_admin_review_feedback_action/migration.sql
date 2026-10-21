-- Public review feedback is recorded as an operational action alongside the
-- verification decision. Preserve the existing allowed action types.
BEGIN;

ALTER TABLE "AdminOperationalAction"
DROP CONSTRAINT "AdminOperationalAction_actionType_allowed_chk";

ALTER TABLE "AdminOperationalAction"
ADD CONSTRAINT "AdminOperationalAction_actionType_allowed_chk"
CHECK ("actionType" IN ('status_change', 'verification', 'note', 'assignment', 'resolution', 'review_feedback')) NOT VALID;

COMMIT;
