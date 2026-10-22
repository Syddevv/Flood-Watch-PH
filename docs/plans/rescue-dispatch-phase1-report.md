> Retired — Rescue Request and Responder Dispatch features removed from active scope. Historical planning or rollout notes below are retained for reference; see [retirement status](../rescue-retirement.md).

# Rescue dispatch Phase 1 review record

**Branch:** `feat/rescue-dispatch-phase1-foundation`
**Date:** 21 October 2026
**Scope:** Shared data foundation and citizen baseline. No responder directory route, automated contact, new dispatch transition, or production migration.

## Baseline and compatibility

The existing request status path remains `received → triaged → assigned → en_route → on_scene → completed`, with cancellation and rejection. `assigned` still means case owner; historical `en_route` does not prove separate acceptance, dispatch, or departure. The existing citizen owner filters, Bulacan validation, idempotent intake, corrections, cancellation, and admin actions remain in place.

The migration adds `workflowVersion` with database default `1`, keeping historical and old-application writes identifiable. Existing events retain a null `source`; new service writes record `citizen` or `admin`. The actor FK becomes nullable only for future `system` events, and the database check requires an actor for citizen/admin events. A new assignment event is internal. The public DTO remains an explicit allowlist and does not include organizations or assignments.

An isolated baseline database received the 26 prior migrations, then one synthetic `en_route` request and one event. After the new migration, the request ID, reference, status, `confirmedTeamReference`, event ID and actor were unchanged; `workflowVersion` was `1` and the old event source remained null. This proves preservation for the fixture, not a census of an operational database. No operational rescue rows or real responder contacts were read or changed.

## Data and rollback

Migration `20261024_rescue_dispatch_foundation` adds responder organizations, historical assignment attempts, optional event metadata and FKs. A partial unique index permits one assignment with `endedAt IS NULL` per request. Organization availability defaults to `unknown`. Organization data is validated against Bulacan locality codes before persistence; database checks constrain availability, assignment states/channels, event source/actor combinations, and workflow version. The internal selection helper checks admin role, triage state, organization coverage and request version, then writes the assignment and private event atomically. There is no HTTP route for it in Phase 1.

Deploy the additive migration before application code that writes event `source` or assignments. For rollback, stop new assignment writes and views first. The old application can continue reading requests because all added fields have defaults or are nullable. Keep additive tables and already recorded attempts; do not drop them as a routine rollback. Restore a reviewed backup or forward-fix a defective migration. Confirm target identity and snapshot before any non-disposable deployment.

## Verification

- `npx prisma validate`: passed.
- `npx prisma migrate deploy` on fresh disposable PostgreSQL: 27/27 migrations applied; `npx prisma migrate status`: up to date.
- Prior 26 migrations replayed into a second disposable database, synthetic legacy row inserted, new migration applied: preserved fields and event verified.
- `npm run lint`, `npm run typecheck`: passed.
- `npm test`: 277/277 passed.
- Focused rescue API and foundation integration tests: 2/2 passed. The foundation test also checked concurrent selection, the one-active database index, sequential attempts, invalid FKs/codes, private events, stale version and non-admin rejection.
- Prisma database-to-schema diff showed only pre-existing drift in `AdminNotification`/`AdminOperationalAction` FKs and `Incident` timestamp defaults; no Phase 1 model drift remained.

## Phase 2 handoff

Add protected admin directory and coordination endpoints/UI. Define verified contact/availability override rules and closed-attempt recording before exposing selection. Preserve private contact details and the `workflowVersion=1` interpretation until Phase 3 introduces the new lifecycle. Phase 2 requires its own branch and review.
