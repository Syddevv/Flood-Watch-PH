> Retired — Rescue Request and Responder Dispatch features removed from active scope. Historical planning or rollout notes below are retained for reference; see [retirement status](../rescue-retirement.md).

# Admin-managed rescue dispatch: admin and shared-data plan

**Status:** Phase 1 merged. Phase 2 implemented with database-backed verification pending. Phase 3 implemented on `feat/rescue-dispatch-phase3-lifecycle`; database-backed verification and migration replay remain pending. Phases 4–6 have not started. See the [Phase 1 report](rescue-dispatch-phase1-report.md), [Phase 2 report](rescue-dispatch-phase2-report.md), and [Phase 3 report](rescue-dispatch-phase3-report.md). This plan and the [citizen plan](rescue-dispatch-citizen-plan.md) extend the implemented rescue foundation. Older `docs/admin-side-plan.md` and `docs/user-side-plan.md` contain historical proposals; inspect current code and migrations before each phase. Responder coordination is a **simulation recorded by admins**. It must never contact an emergency service automatically or imply a live dispatch.

## Current architecture and invariants

| Area | Current implementation | Preserve |
| --- | --- | --- |
| Stack | Next.js 16.2.6 App Router, React 19, TypeScript, Prisma 7/PostgreSQL, Tailwind; scripts in `package.json`. | Existing dependencies, session system, Flood Watch design. Read relevant `node_modules/next/dist/docs/` guides before any Next code change, per `AGENTS.md`. |
| Rescue persistence | `RescueRequest` and append-only `RescueRequestEvent` in `prisma/schema.prisma`; additive `20261019_rescue_foundation` and `20261020_admin_assisted_rescue_intake` migrations. Stable ID/reference, version, idempotency key, Bulacan locality, optional report link, case owner and free-text `confirmedTeamReference`. | IDs, references, citizen/assisted intake, current data, event order, consent and location rules. Do not convert historical “Rescue Needed” flood reports automatically. |
| Shared rules | `lib/rescue-contracts.ts` validates intake/corrections/actions and permits `received → triaged → assigned → en_route → on_scene → completed`, plus `cancelled`/`rejected`. `lib/rescue-service.ts` uses transaction and request-version compare-and-swap for corrections/admin actions. | Server validation, idempotent intake, ownership, 409 stale-version behavior and existing events. |
| Admin API | `app/api/admin/rescue-requests/route.ts`, `[id]/route.ts`, `[id]/actions/route.ts`, `export/route.ts` use `requireProtectedAdminApi` for admin role, origin and rate limiting. | Same authorization boundary; no responder account, session, route or dashboard. |
| Admin UI | `components/admin-shell.tsx` navigation; `admin-rescue-requests.tsx` queue; `admin-rescue-detail.tsx` long action form; admin-assisted intake modal/page. `lib/admin-rescue-queue.ts` supplies filtered/paged rows and bounded CSV. | Working filters, paging, intake, owner actions, export privacy, theme and responsive layout. |
| Alerts/analytics | `AdminNotification` supports recipient/dedupe/read state; `AdminAuditLog` and `AdminOperationalAction` exist. `lib/admin-analytics.ts` computes bounded rescue counts and legacy event durations. | Database-derived metrics and existing notification behavior; no fabricated sample counts. |
| Proof | `tests/rescue-contracts.test.ts`, `tests/rescue-queue-policy.test.ts`, `tests/integration/rescue.integration.test.ts`, browser rescue specs; isolated integration DB via `TEST_DATABASE_URL`. | Unit, integration and browser conventions; never point test or demo seed at production. |

**Conflict to resolve:** Current `assigned` means a case owner is set; it is not an accepted responder assignment. Current `en_route` stores a team reference and acknowledgement reason in one step; it cannot prove distinct acceptance, dispatch and departure. The new workflow must keep these historical facts visible without inventing missing contact or dispatch events. `confirmedTeamReference` remains readable for legacy cases; new coordination uses relational assignments as the source of truth.

## Six-phase sequence and ownership

| Phase | Admin/shared-data delivery | Dependency and stop gate |
| --- | --- | --- |
| 1. Audit/data foundation | Confirm baseline; additive organization, assignment and event metadata schema; migrations and persistence tests. | Existing rescue foundation. Review before phase 2. |
| 2. Directory/coordination | Admin directory, selection, manual contact/acknowledgement, declined/unreachable history and reassignment. | Phase 1 records. Review before phase 3. |
| 3. Lifecycle/dispatch | Central transition policy, confirmation/departure/arrival/resolution/closure, atomic writes and compatibility rules. | Phase 2 assignments. Review before phase 4. |
| 4. Admin UI | Queue, metrics, detail sections and timeline using real data. | Phase 3 API/state. Review before phase 5. |
| 5. Citizen tracking | Admin-side public event and alert support consumed by [citizen plan](rescue-dispatch-citizen-plan.md). | Phase 4 stable contracts. Review before phase 6. |
| 6. Proof/analytics/demo | Cross-flow tests, duration metrics, safe demo fixtures, release checks. | Phase 5. Final review. |

Use a new branch for each approved phase, as requested for earlier phased work. After each phase, update its checkboxes and report files, schema/rollback, behavior, compatibility, actual test results, issues and next phase. Stop for approval before starting the next phase. These boxes describe future work; none is checked by writing this plan.

## Phase 1 — Repository audit and data foundation

### Proposed database changes

- Add `ResponderOrganization` with ID, name, type, Bulacan home locality code, coverage locality codes, capability codes, contact office/person, official phone, optional secondary contact, preferred channel, availability (`available`, `busy`, `unavailable`, `unknown`), active flag, `lastContactVerifiedAt`, demo flag, and created/updated timestamps. Default availability `unknown`. Normalize and validate coverage against `BULACAN_LOCALITIES`; neither listing nor availability implies live readiness. Do not place unverified real contact details in demo seeds.
- Add `RescueAssignment` with request/organization FKs, actor admin, status, selected/recorded timestamps, channel, contact-attempt outcome/details, acknowledgement outcome/time/admin, dispatch confirmation/time/admin/method, departure/arrival times, reported completion time, resolution details and end/reassignment reason. Retain every attempt. Prefer one active assignment per request for this single-dispatch workflow; enforce with a PostgreSQL partial unique index plus transactional checks. Multiple historical attempts are allowed. Revisit simultaneous team assignments only if a concrete workflow requires them.
- Extend `RescueRequestEvent` with optional assignment FK, source (`citizen`/`admin`/`system`), structured details and optional reported occurrence time. Keep `createdAt` as server-recorded time; do not backdate it. Existing event rows stay valid with nullable/defaulted additions. Reuse this timeline for received, triage, owner, priority, selection, attempt, acceptance/decline, dispatch, progress, reassignment, resolution, cancellation and closure. Keep private contact details in admin-only fields/events.
- Add indexes/checks for organization search, assignment request/time/status, valid codes/states and event lookup. Prisma schema and SQL migration must agree; raw SQL may be needed for partial uniqueness. No destructive rename, status rewrite or table replacement. Snapshot counts/IDs/statuses before and after migration; `prisma migrate status` and isolated migration replay are required. Roll back app writes/views first and leave additive tables intact if records exist; restore a backup or forward-fix after review.

### Server and proof

- [x] Re-audit current schema, migrations, service, routes, queue, analytics, UI and tests; record baseline behavior, counts and representative legacy statuses before editing. The synthetic pre-migration baseline had one `en_route` request and one event; operational database counts were not read.
- [x] Implement additive Prisma schema/migration and relations; use stable database defaults or nullable additions so rolling application versions still read existing rows. `workflowVersion=1` distinguishes historical records without changing their status.
- [x] Add validation/DB helpers for organization and assignment codes. Require an admin actor for operational records; source and recorded timestamp come from server. New organizations default to unknown availability; existing events retain null source.
- [x] Create assignment/event persistence through `lib/rescue-service.ts` or a focused helper used by it. No new public mutation in this phase. Keep current citizen submission and admin actions working.
- [x] Test migration on disposable PostgreSQL, historical-row preservation, FKs, unique active assignment, event order and rejection of invalid data. Run focused rescue unit/integration tests, lint and typecheck. Results and limits are in the Phase 1 report.

**Acceptance:** All existing request IDs/references/statuses remain unchanged; citizen submissions still work; organizations and multiple sequential assignment attempts persist; one active assignment rule holds under race; authorization and existing API behavior pass. No real contacts or responder accounts are created.

## Phase 2 — Directory and manual coordination

**API/server:** Add admin-only organization list/create/detail/update endpoints following `requireProtectedAdminApi`, bounded search/filters (locality, capability, availability), field allowlist and rate limits. Add admin-only assignment actions to the existing rescue action route or focused nested routes that call the same service/transaction. Selecting an organization records a selection event; it does **not** mark it accepted or dispatched. Record each phone, manually logged SMS, radio or other approved channel attempt with outcome `awaiting_response`, `accepted`, `declined`, `unreachable` or `unavailable`, notes, actor and timestamps. An admin-recorded acceptance is labeled as such; it is not a responder-authenticated statement. Decline/unreachable closes that attempt and permits a new attempt, preserving history. Require current request version/action idempotency where replay could duplicate contact entries. Reject inactive, out-of-coverage or stale/unverified availability with a clear override reason when policy permits; missing contact method blocks contact recording.

**Pages/components:** Add `/admin/responders` and a directory component in the current shell navigation. Add a Responder Coordination section to `/admin/rescue-requests/[id]` with coverage/capability/contact review and manual attempt form. Keep contact data out of queue/export and public DTOs. Indicate demo organizations and unknown availability. No responder-facing UI.

- [x] Build directory CRUD, filters and activate/deactivate controls with useful empty, error and loading states.
- [x] Add organization selection, channel, contact attempt and acknowledgement actions with server validation.
- [x] Add decline/unreachable/reassignment flow and chronological event display; prevent duplicate pending attempts.
- [ ] Run database-backed tests for admin/non-admin access, invalid coverage/contact data, duplicate clicks, stale request versions, declined attempt/reassignment and zero external sends. The integration test is written; this workspace lacks `TEST_DATABASE_URL` and a running PostgreSQL engine.

**Acceptance:** Admin can manage and select organizations; contact and acknowledgement are separate persisted facts; reassignment retains old attempts; the request remains active after a failed attempt. No service is contacted by the app.

**Directory UI refinement (22 October 2026):** `/admin/responders` now uses a compact card list and a shared add/edit modal with labeled capability choices and searchable multi-municipality coverage. The configured database currently lacks `20261024_rescue_dispatch_foundation`; the directory API returns a specific setup error until that additive migration is reviewed and deployed. No migration was run against the configured database during this UI change. Phase 3 is implemented on a separate branch; see its report for verification limits.

## Phase 3 — Lifecycle and dispatch management

**Central policy:** Extend `lib/rescue-contracts.ts` and `lib/rescue-service.ts`; do not rely on hidden UI controls for enforcement. New states are `received`, `under_review`, `awaiting_responder`, `responder_confirmed`, `dispatched`, `en_route`, `on_scene`, `resolved`, `closed`. Exceptional terminal outcomes: `cancelled`, `duplicate`, `referred`, `unable_to_contact`. Keep historical `triaged`, `assigned`, `completed`, `rejected` readable and accepted by DB constraints. Do not silently relabel old rows or backfill fictional assignments. Show them as legacy; define explicit admin reconciliation transitions for open cases, with reason/event, while legacy terminal cases stay terminal. Any change to old direct `assigned → en_route` action must be coordinated with the admin UI and tests in this phase so clients cannot create an unverified new dispatch.

| Transition | Required persisted evidence |
| --- | --- |
| Received → Under Review | Admin starts review. |
| Under Review → Awaiting Responder | Triage completion, priority, notes/needs, case owner or documented unassigned reason. |
| Awaiting Responder → Responder Confirmed | Active assignment with admin-recorded acceptance and acknowledgement time. |
| Responder Confirmed → Dispatched | Explicit dispatch confirmation, org, admin, channel, server timestamp. |
| Dispatched → En Route | Separate departure update and its reported occurrence time if known. |
| En Route → On Scene | Arrival update. |
| On Scene → Resolved | Outcome code, description, reported completion time and responsible org. |
| Resolved → Closed | Final documentation and admin closure. |

Exceptional transitions require admin role, reason and a policy-allowed source state. Reassignment after acceptance/dispatch must close the old active assignment and record why; it must not erase dispatch history. `cancelled` from citizen early in the workflow preserves current behavior; later citizen requests trigger admin review. `duplicate` links an existing request where authorized; `referred` records destination without claiming dispatch; `unable_to_contact` requires documented attempts. Case ownership stays independent of responder selection. Keep `confirmedTeamReference` for legacy display, but new dispatch facts come from the assignment.

**Atomicity:** One transaction changes request status/version, assignment, event and alert intent. Compare-and-swap on `RescueRequest.version`; stale writes return 409 and do not leave partial changes. Make consequential actions replay-safe with an action idempotency key or uniqueness constraint. A repeated dispatch confirmation must not create a second event. Notification failure must not roll back a committed rescue transition or report it as unsaved; persist notice intent in the transaction and retry delivery/view separately.

- [x] Expand status DB check and shared status/terminal/transition maps; add legacy compatibility mapping and direct-action deprecation.
- [x] Implement evidence gates, exceptional reasons, resolution outcome validation and close documentation.
- [ ] Run database-backed transaction/CAS/idempotency and race tests for status, assignment, event and notification consistency. Focused integration coverage is written but `TEST_DATABASE_URL` is unavailable.
- [ ] Verify every legal transition against a migrated database, including skips, stale versions, repeated dispatch, unauthorized actors and impossible timestamp order. The unit transition matrix passes; the integration suite is skipped without a test database.

**Acceptance:** Every new state survives reload; selection, acceptance, dispatch, departure and arrival are distinct; invalid skips fail server-side; every committed state change has one ordered event; historical records remain intelligible.

## Phase 4 — Admin rescue management UI

**Queue and metrics:** Extend `lib/admin-rescue-queue.ts` without losing existing status/priority/locality/search/sort/pagination/CSV behavior. Show reference, locality/barangay, priority, lifecycle state, people count, case owner, active organization, last update and follow-up indicator; no routine citizen phone in summary. Count active, awaiting triage, awaiting responder, confirmed, dispatched/in progress, resolved and follow-up from indexed database queries. Define active versus terminal once in shared policy. Replace legacy `triaged`-only overdue assumptions. Keep CSV bounded and formula-safe.

**Detail:** Refactor `components/admin-rescue-detail.tsx` into Request Overview, Administrative Triage, Responder Coordination, Rescue Progress and Activity Timeline. Render allowed actions from server-supported policy; confirm consequential actions; show actor/recorded time and reported occurrence time when both exist. Use existing styling, accessible labels/focus/keyboard controls, responsive layout, disabled/loading/error/success states, 409 refresh handling and no unnecessary reloads. Update `/admin/rescue-requests/[id]` and shell navigation only where needed.

- [ ] Update queue filters/rows/summary/export with the new statuses and assignment relation.
- [ ] Split detail actions into the five sections; show only valid actions and accurate timeline facts.
- [ ] Verify desktop/mobile, keyboard and screen-reader labels, empty/error states and action confirmation.
- [ ] Run queue/API/browser regressions for legacy cases, assisted intake, filters and 409 conflicts.

**Acceptance:** Existing navigation, filters and intake work; queue and metrics match DB; admins can complete lifecycle without direct arbitrary status jumps; history shows the correct actor and time.

## Phase 5 — Admin side of citizen tracking

The [citizen plan](rescue-dispatch-citizen-plan.md) owns public labels, pages and owner updates. Admin/shared-data tasks here: mark every event `public` or `internal` at write time, construct a safe public projection in `lib/rescue-dto.ts`, and send only confirmed public status facts to the owner notification path. Reuse `AdminNotification` recipient/dedupe storage only after adding an owner-scoped read endpoint/DTO; its current routes are admin-only. Queue admin notices for citizen updates, overdue triage and unanswered assignments using stored timestamps and dedupe keys. Choose a bounded scheduled or request-time follow-up mechanism already compatible with deployment; no paid provider.

- [ ] Expose only public event fields; omit responder contact/person, internal notes, actor IDs, structured private metadata and admin audit details.
- [ ] Add owner-scoped citizen notification read semantics and admin follow-up notice generation with dedupe/retry behavior.
- [ ] Test owner isolation, private field absence, public update accuracy and notification failures.

**Acceptance:** Admin actions reach the correct citizen timeline/notice; private operational details remain admin-only; missing delivery does not change case truth.

## Phase 6 — End-to-end proof, analytics and demo

- [ ] On isolated DB, exercise Plaridel intake → queue → triage/owner → demo org phone attempt/unreachable → second org acceptance → dispatch → departure → scene → outcome → close; verify all states/events after reload and citizen projection.
- [ ] Add tests for unauthorized admin access, cross-owner reads, invalid transitions, intake/action replay, concurrent admins, decline/reassignment, cancellation, missing contacts, stale availability, malformed location, empty queue, DB/network failures, notification failure and mobile layouts.
- [ ] Extend `lib/admin-analytics.ts` with DB-derived locality/priority/status, assignment attempts, acknowledgement rate and durations from **stored** submission/triage/acknowledgement/dispatch timestamps. Separate legacy and missing-data samples; never infer dispatch from old `en_route`. Label simulation data and unavailable metrics.
- [ ] Add idempotent demo organizations and sample cases only to a guarded development/demo seed path. Never alter existing users/citizen records or use real contact details. Keep current production seed behavior unchanged unless safely gated.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, isolated `npm run test:integration`, production build with required env, Prisma migration checks and focused browser tests. Report commands and actual outcomes; list environment-limited gates.

**Acceptance:** Full scenario and privacy/security/race cases pass; analytics reconcile with stored records; no fictional live availability or responder position appears. Document backup, migration rollout and app rollback in `docs/rescue-foundation-operations.md` or a focused operator runbook.

## Compatibility and security risks to track

1. **Legacy status meaning:** Existing `assigned`, `en_route`, `completed`, `rejected` have different semantics. Preserve raw values and history; require explicit reconciliation before new operational claims. Update analytics, queue, terminal logic and citizen labels together.
2. **Concurrent assignment:** Two admins may choose organizations at once. Request-version CAS plus one-active-assignment DB constraint must make one attempt fail cleanly, with no orphan event.
3. **Sensitive data:** Request phone, exact coordinates and vulnerability notes are in owner/admin DTOs today. Keep directory contacts and private events admin-only; review queue/export, logs, analytics and notification payloads for leakage.
4. **Unverified responders:** Demo organizations and stale availability must never read as verified real-world capacity. No automated calls, SMS, email or dispatch integration.
5. **Migration/rollback:** Additive migration and old/new app overlap require defaults/nullability and reviewed constraints. Preserve writes already made if app is rolled back; do not drop tables as a routine rollback.
6. **Notification semantics:** `AdminNotification` is currently admin-only despite recipient support. Citizen access needs a separate owner-scoped API and safe type/detail projection; follow-up alerts need durable dedupe.
7. **Testing environment:** Integration tests require disposable `TEST_DATABASE_URL`; build requires configured secrets. Never run seed/migration/test against production merely to satisfy a checklist.
