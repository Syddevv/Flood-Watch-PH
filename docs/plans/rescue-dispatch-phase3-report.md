# Rescue dispatch Phase 3 review record

**Branch:** `feat/rescue-dispatch-phase3-lifecycle`  
**Date:** 22 October 2026  
**Scope:** Evidence-backed admin-recorded lifecycle and dispatch, legacy reconciliation, and safe citizen labels. No automatic call, message, responder login, or production migration was performed.

## Behavior and compatibility

New requests start at `workflowVersion=2`; historical rows retain their stored status and `workflowVersion=1`. A legacy open request must move to `under_review` with a recorded reason before new responder lifecycle stages. Historical `en_route` and `on_scene` remain visible as legacy labels and never count as independently confirmed dispatch. Direct `transition` actions are retired; the admin detail sends a versioned, replay-keyed `lifecycle` action. Case ownership remains separate from responder selection.

The lifecycle requires triage notes and an owner or unassigned reason, an active assignment with an admin-recorded acceptance, explicit dispatch confirmation, departure, arrival, outcome and reported completion time, then final closure documentation. Exceptional outcomes require a reason; duplicate links an existing request, referral names a destination, and unable-to-contact requires a recorded contact attempt. Accepted or dispatched assignments can be reassigned with a reason; the old attempt and its timestamps remain. Citizen early cancellation still closes an uncoordinated request; later or active-assignment cancellation creates a review event and admin notice intent.

Every lifecycle action uses request-version compare-and-swap and an event action key/hash. Request status, assignment fields, one event, and admin notice intent are written in one transaction. Replaying the same action key returns the current request without another event; reusing it with changed evidence is rejected. Public DTOs omit private event details, reasons, contact data, and admin actor IDs. Stored admin notices are delivery/view intents; no external responder or citizen message is sent.

## Migration and rollback

`20261025_rescue_dispatch_lifecycle` expands the `RescueRequest.status` check while retaining all legacy values. It adds nullable event `actionKey`/`actionHash` and a unique `(requestId, actionKey)` index. It does not rewrite existing rows. Run the Phase 1/2 foundation migration before Phase 3, snapshot request counts/IDs/statuses, then apply and verify this migration on an isolated database before deployment. The app requires this migration before new lifecycle writes.

For rollback, stop Phase 3 writes and restore the earlier app version only after checking whether any version-2 statuses were recorded. Existing new-status rows must be preserved; use a forward compatibility fix or a reviewed data recovery plan instead of dropping columns or silently relabeling them. The additive columns and widened check may remain during an application rollback.

## Verification

- `npm run lint`, `npm run typecheck`, `npm run test` (282/282), `npm run build`, and `npx prisma validate`: passed.
- Focused rescue integration files: discovered but all skipped because `TEST_DATABASE_URL` is unset. Docker daemon and local PostgreSQL binaries are unavailable in this workspace. Migration replay, race behavior, persistence and authenticated browser flows are therefore unverified.
- No database migration was applied, and no live responder service was contacted.

## Before Phase 4

Apply the Phase 1/2 and Phase 3 migrations to an isolated PostgreSQL database. Run the focused integration suite and mobile/desktop admin and citizen flows, including direct-action rejection, replay, reassignment after dispatch, exceptional outcomes, privacy, timestamps, and rollback rehearsal. Review the Phase 3 results before starting the Phase 4 queue/detail UI refactor.
