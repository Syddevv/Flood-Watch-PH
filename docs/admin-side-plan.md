# Flood Watch — admin-side implementation plan

## Objective and scope

Turn the existing administrator workspace into a database-backed **Flood Watch** operations tool for the whole **province of Bulacan**, using the repository’s Next.js 16, Prisma/PostgreSQL, cookie-session, Cloudinary, and Leaflet architecture. This plan owns the shared rescue backend and the center-management backend. The public-facing work is in `docs/user-side-plan.md`. Proposed routes/models below do not yet exist unless explicitly marked current.

## Current implementation and gaps

| State | Verified repository evidence |
| --- | --- |
| Working | `app/admin/page.tsx` and `lib/admin-auth.ts` enforce administrator role from database sessions. `app/api/admin/reports/route.ts` provides a filtered/paginated report list and admin creation; `app/api/admin/reports/[id]/verification/route.ts`, `app/api/admin/reports/[id]/status/route.ts`, and `app/api/admin/reports/[id]/notes/route.ts` write report decisions/actions. `prisma/schema.prisma` has `FloodReport.verificationStatus`, `AdminAuditLog`, `AdminOperationalAction`, and `AdminNotification`. `lib/request-security.ts` supplies origin and rate-limit protection. |
| Partial | `app/api/admin/evacuation-centers/route.ts` and `app/api/admin/evacuation-centers/[id]/route.ts` provide database CRUD; `app/api/admin/evacuation-centers/[id]/archive/route.ts` and `app/api/admin/evacuation-centers/[id]/restore/route.ts` exist. `prisma/schema.prisma` has source/verification/capacity fields from `prisma/migrations/20260829_evacuation_center_management/migration.sql`. `components/admin-evacuation-center-detail.tsx` fetches database detail but its status/note buttons do not save; `app/admin/data/new/page.tsx` is a placeholder; `components/admin-evacuation-centers-page.tsx` lists static `NEARBY_EVACUATION_CENTERS`. `lib/admin-evacuation.ts` validates coordinate range, not Bulacan polygon. |
| Preview | `components/admin-rescue-requests.tsx` contains in-memory sample rows/counts and disabled pagination; `app/admin/rescue-requests/new/page.tsx` is a placeholder. `components/admin-overview-data.ts` and `components/admin-live-map.tsx` mix real-looking labels with fictional rescue/occupancy activity; `components/admin-notifications.tsx` renders hardcoded notices despite the notification model. `components/admin-analytics.tsx` hardcodes metrics, graph points, barangays, severity, and CSV. |
| Missing/inconsistent | `prisma/schema.prisma` has no `RescueRequest` model/migration or email-verification model. `components/rescue-request-content.tsx` currently submits a “Rescue Needed” flood report and invents a local RR ID. Report verification PATCH lacks a compare-and-swap check (`app/api/admin/reports/[id]/verification/route.ts`); operational status currently maps a community-confirmed report to “verified” in `lib/admin-contracts.ts` and `app/api/admin/reports/[id]/status/route.ts`, so concepts need separation. `app/api/admin/reports/route.ts` writes `locationSource: "admin"` although `prisma/migrations/20260826_report_capture_metadata/migration.sql` allows only GPS/map/search/manual. |

Current migrations also include `20260826_user_accounts`, `20260829_admin_auth`, `20260829_report_verification`, and `20260906_admin_phase0_foundation`. Existing integration tests in `tests/integration/` require isolated `TEST_DATABASE_URL` (`tests/integration/README.md`); Playwright is configured in `playwright.config.ts`.

## Shared dependencies and execution order

| Order / parallel lane | Owning phase | Deliverable and dependency | Enables |
| --- | --- | --- | --- |
| 1 | **U0** | Sourced Bulacan geometry, locality IDs, shared scope/brand; first for every geography-dependent feature. | U1, U2, U4, U5, A0–A5 |
| 2 | **A0** | Sole owner of rescue schema, migration, state machine, user/admin API contracts and event history; consumes U0. | U5, A3, A4 |
| 3, parallel | **U3**, **U1**, **A1** | Verified-account gate; Bulacan weather; report verification. U1/A1 need U0; U3 builds on current sessions. | U5 release, A5 |
| 4, parallel | **U2**, **A2** | Onsite report rules; canonical center backfill/API/admin management. U2 needs U0; A2 needs U0. | U6; U4 |
| 5, parallel | **U4**, **U5**, **A3** | Public resources/contact data; user rescue UI; admin intake modal. U4 consumes A2; U5/A3 consume A0; release U5 with U3 gate. | A4, U6 |
| 6 | **A4**, then **A5** | Rescue operations connects both intakes; analytics consumes real report/center/rescue data. | U6, A6 |
| 7 | **U6**, then **A6** | User-to-admin acceptance, migration/release checks and operating readiness. | Release decision |

**Ownership:** U0 owns shared Bulacan geometry; A0 owns every shared rescue model, migration, validator, state transition, and user/admin rescue API; A2 owns center backfill, center persistence and public center API; U4 owns emergency-contact delivery; A5 owns analytics aggregation. Other phases consume those contracts rather than recreate them. Rescue intake, public history, and admin operations are intentionally interleaved.

## A0 — Shared rescue contracts and data foundation

**Goal.** Create one secure, durable rescue-request system for public and administrator clients, separate from flood reports.

**Tasks**
- [x] Propose `RescueRequest` with stable public reference, requesterUserId (nullable for admin-assisted intake), creatorUserId, intakeChannel, assisted-person relationship/name as needed, contact, people count, vulnerability tags/notes, description, precise location and U0 locality ID/barangay, optional `FloodReport` link, priority, workflow status, case-owner admin ID, optional externally confirmed responder/team reference, outcome, version, and server timestamps. Encrypt or otherwise protect especially sensitive fields at rest if operating policy requires it; document retention/deletion.
- [x] Propose append-only `RescueRequestEvent` (actor, event type, prior/next status/priority/assignee, public/internal visibility, reason, server time, request ID), plus unique idempotency key scoped to actor/channel. Add indexes for requester+createdAt, status+priority+updatedAt, locality+status, assignee+status, reference, and events by request+time.
- [x] Implement one shared validator/DTO set and the transition table below. Priority (`routine/urgent/critical`) is separate from status; no client may set requester, creator, actor, server timestamps, dispatch acknowledgment, or final outcome directly.
- [x] Use transactions with versioned compare-and-swap updates (`expectedVersion`, 409 on stale writes), event/audit writes, and idempotent intake; paginate with a stable cursor. Evaluate near-duplicate warnings by requester/contact/time/location without silently merging distinct emergencies.
- [x] Define public routes: `POST /api/rescue-requests` (primary/alternate contact, people, needs, self/other, location/locality/barangay, description, optional reportId; `Idempotency-Key`; 201 or replayed ID), `GET /api/rescue-requests?cursor&limit`, `GET /api/rescue-requests/[id]`, and `PATCH /api/rescue-requests/[id]` (`expectedVersion` plus allowlisted contact/description/location correction before assignment or cancellation request). Define admin routes: `GET/POST /api/admin/rescue-requests` (admin POST also requires `intakeChannel` and resident contact), `GET /api/admin/rescue-requests/[id]`, and `POST /api/admin/rescue-requests/[id]/actions` (`expectedVersion`, action type, and action-specific priority/caseOwnerUserId/confirmed team/reason/note/visibility/outcome) for triage, assignment, dispatch acknowledgment, status, notes, and outcome.
- [x] Return existing `admin-api-response`-style envelopes; use 400 invalid data/transition, 401 unauthenticated, 403 or privacy-preserving 404 unauthorized, 404 missing, 409 stale/duplicate conflict, 429 rate limit, and 503 persistence failure. Public DTO includes only requester-safe events; admin DTO includes authorized contact and internal context.
- [x] Keep legacy “Rescue Needed” flood reports as reports. Provide optional, deliberate admin linking/conversion with explicit consent/data review; never auto-create dispatch requests from all historical or new category matches.

**Proposed lifecycle**

| Current | Allowed next | Rule |
| --- | --- | --- |
| `received` | `triaged`, `rejected`, `cancelled` | Intake acknowledgment is server-created; rejection needs reason. Requester may cancel before assignment. |
| `triaged` | `assigned`, `rejected`, `cancelled` | Priority can change independently; case owner assigned only to authorized admin. |
| `assigned` | `en_route`, `triaged`, `cancelled` | Reassignment is an event; `en_route` requires a real dispatch acknowledgment/team reference. Cancellation after assignment requires admin confirmation. |
| `en_route` | `on_scene`, `triaged` | Returning to triage requires an explicit reason and acknowledgment; requester cannot self-cancel silently. |
| `on_scene` | `completed`, `triaged` | Completion requires an outcome; return requires reason. |
| `completed`, `cancelled`, `rejected` | none | Terminal; corrections require a separately audited reopen policy, not ordinary PATCH. |

For MVP, `caseOwnerUserId` refers to an existing administrator coordinator; it does **not** assert a responder team was dispatched. A real team directory or external dispatch integration is a separate operational decision. Do not render “Team Dispatched” until an authorized operator records a confirmed dispatch event.

**Files.** Existing: `prisma/schema.prisma`, `lib/auth-session.ts`, `lib/admin-auth.ts`, `lib/request-security.ts`, `lib/admin-audit.ts`, `lib/admin-action-service.ts`, `lib/admin-api-response.ts`, `lib/rescue-request-form.ts`, `lib/rescue-request-data.ts`. Proposed: one Prisma rescue migration, `lib/rescue-contracts.ts`, `lib/rescue-service.ts`, `lib/rescue-dto.ts`, `app/api/rescue-requests/route.ts`, `app/api/rescue-requests/[id]/route.ts`, `app/api/admin/rescue-requests/route.ts`, `app/api/admin/rescue-requests/[id]/route.ts`, and `app/api/admin/rescue-requests/[id]/actions/route.ts`. No rescue UI here; A3/A4/U5 consume these APIs.

**Dependencies/security/failure.** Needs U0 polygon/locality identifiers; U3 determines production verified-user gate. Require trusted origin/rate limits, server-derived identity, strict ownership, minimum necessary DTOs, bounded request bodies, no private detail in audit metadata/notifications, and transactional event creation. Outage must return failure without showing a local “received” record.

**Acceptance.** The same persisted request appears to its owner and admin; identical idempotency retries return one ID; every legal transition produces one ordered event and illegal/stale transitions produce no change; private user B cannot read user A’s request; terminal states cannot mutate; no “Rescue Needed” flood report becomes a request automatically.

**Tests.** Unit: transition matrix, priority independence, validation/DTO redaction. Integration: migration, intake/replay, ownership/role, simultaneous actions, pagination, event atomicity and linked-report policy. Browser: API-backed smoke flow from U5/A3 when those UIs exist.

## A1 — Flood report verification

**Goal.** Strengthen the existing report list/detail and verification endpoint into a defensible review workflow.

**Tasks**
- [ ] Extend `components/admin-flood-reports.tsx` queue with unreviewed/disputed/rejected filters, age/severity/municipality sorting, evidence completeness, and stable pagination from `GET /api/admin/reports`.
- [ ] Show image, capture timestamp, GPS source/accuracy/freshness, U2 onsite-eligibility state, location provenance, nearby reports, incident grouping, community confirmation counts, previous admin decisions, and timestamps in `components/admin-report-detail.tsx`.
- [ ] Keep three independent fields/concepts: community confirmation, admin `verificationStatus`, and operational/public resolution. Do not infer admin verification from `Confirmed by Community` or GPS metadata. Define verified/disputed/rejected decision rules and mandatory reason/evidence for dispute/rejection; sanitize public-facing feedback separately from internal notes.
- [ ] Add reviewer ID/time and reason/decision history; require `expectedVersion`/`updatedAt` in verification PATCH with atomic compare-and-swap and 409 conflict refresh. Align operational status mapping so “verified” cannot mean merely community confirmed.
- [ ] Decide listing/aggregation policy: proposal—unreviewed remains visibly provisional, disputed visibly flagged, rejected removed from normal public lists/map and analytics operational totals but retained for owner/admin review. Recompute incident summary if a member report is rejected; never delete evidence silently.

**Files.** Existing: `prisma/schema.prisma`, `app/api/admin/reports/route.ts`, `app/api/admin/reports/[id]/route.ts`, `app/api/admin/reports/[id]/verification/route.ts`, `app/api/admin/reports/[id]/status/route.ts`, `app/api/admin/reports/[id]/notes/route.ts`, `lib/admin-contracts.ts`, `lib/admin-report-dto.ts`, `components/admin-flood-reports.tsx`, `components/admin-report-detail.tsx`, `app/api/reports/route.ts`, `app/api/map/all/route.ts`. Proposed: migration for reviewer/time/reason/version or dedicated review events; focused verification policy module. API/UI semantics change.

**Dependencies/security/failure.** Needs U0 locality and coordinates with U2 evidence flags; A5 consumes final counting policy. Admin guard and audit already exist but decision history must be atomic with the report update. Public reasons must exclude private reporter/contact data. On conflict, show latest decision and require deliberate retry.

**Acceptance.** Two reviewers cannot overwrite each other silently; every rejection/dispute has actor/time/reason; public status, confirmation count, admin verification, and operational resolution display independently; rejected reports follow the agreed list/map/incident policy.

**Tests.** Unit: decision rules, status separation, DTO filtering. Integration: role guard, required reasons, race/409, audit rollback, list/map/incident counts. Browser: queue filters, evidence/detail, simultaneous-review refresh, public feedback.

## A2 — Province-wide evacuation center management and canonical data

**Goal.** Make admin management and public center views use one verified Bulacan database, with honest capacity/status semantics.

**Tasks**
- [ ] Audit static `data/evacuation-centers.ts` against `EvacuationCenter` rows and official LGU/PDRRMO/MDRRMO/CDRRMO sources; write a dry-run import/backfill keyed by source ID/name+location, detect duplicates, preserve admin edits, record source URL and last verification, archive or quarantine out-of-province/demo rows without destructive deletion.
- [ ] Add U0 polygon/locality ID validation to create/edit and imported rows; reconcile status vocabulary across `prisma/schema.prisma` default “Unknown”, `lib/admin-evacuation.ts` values, seed data, and UI (`components/admin-evacuation-center-detail.tsx` currently accepts `sample_demo` as a verification value). Separate verified center identity from real-time availability. **Remaining:** official import/backfill and its locality validation; create/edit and legacy status normalization are implemented.
- [x] Connect `components/admin-evacuation-centers-page.tsx` to existing protected list API with search, municipality, archived and verification filters, pagination, loading/empty/error states. Replace `app/admin/data/new/page.tsx` placeholder; make detail edit/status/note/archive/restore controls functional and conflict-aware.
- [x] Propose public `GET /api/evacuation-centers` and `GET /api/evacuation-centers/[id]` from the same records; expose only non-archived, policy-approved fields, and support list/map/nearest queries for U4. Source and freshness must be visible.
- [ ] Define `estimatedCapacity` as planning capacity only. If actual occupancy is approved, add separately permissioned `occupancyCount`/`occupancyUpdatedAt` with 0≤occupancy≤capacity validation, source/operator history, and staleness rule; otherwise remove sheltered/utilization claims from overview/analytics.

**Files.** Existing: `prisma/schema.prisma`, `prisma/seed.ts`, `data/evacuation-centers.ts`, `lib/admin-evacuation.ts`, `app/api/admin/evacuation-centers/route.ts`, `app/api/admin/evacuation-centers/[id]/route.ts`, `app/api/admin/evacuation-centers/[id]/archive/route.ts`, `app/api/admin/evacuation-centers/[id]/restore/route.ts`, `components/admin-evacuation-centers-page.tsx`, `components/admin-evacuation-center-detail.tsx`, `app/admin/data/new/page.tsx`, `app/api/map/all/route.ts`. Proposed: `app/api/evacuation-centers/route.ts`, `app/api/evacuation-centers/[id]/route.ts`, audited import script, migration for locality/version/source history and optional occupancy. U4 owns public UI, not center persistence.

**Dependencies/security/failure.** Needs U0; U4 waits for public API/backfill. Admin mutations stay role protected/rate limited and log actor/diff without leaking internal notes; stale writes produce 409. Official source collection is a data prerequisite. If import fails, retain current rows and publish no unverified additions.

**Acceptance.** A verified Bulacan center created/edited/archived/restored via admin is reflected correctly in public API after refresh; non-Bulacan/duplicate submissions fail or require review; all localities can show sourced centers or an explicit data gap; no estimated capacity is rendered as occupancy.

**Tests.** Unit: status normalization, geometry, duplicate key, capacity/occupancy rules. Integration: protected CRUD/archive/restore, import idempotency/rollback, public sync and DTO privacy. Browser: create/edit/map placement/search/filters/archived/conflict/empty states and public list/detail.

## A3 — New rescue request modal and admin-assisted intake

**Goal.** Replace the admin intake placeholder with an accessible form using A0 contracts.

**Tasks**
- [ ] Make “New rescue” open a modal in `components/admin-rescue-requests.tsx`; keep direct `/admin/rescue-requests/new` navigation meaningful with the same form in a page shell or deep-linked modal.
- [ ] Support phone/walk-in/other assisted intake with requester/assisted-person relationship, callback/contact, people and vulnerability details, U0 Bulacan municipality/barangay/point, description, optional linked report, and initial priority. Record authenticated creator and intake channel separately from assisted person; never invent a user account.
- [ ] Reuse A0 validation and `POST /api/admin/rescue-requests`; include field errors, focus trap/return, Escape, keyboard controls, mobile layout, pending state, idempotency key, duplicate warning, success ID, and list refresh.

**Files.** Existing: `components/admin-rescue-requests.tsx`, `app/admin/rescue-requests/new/page.tsx`, `components/admin-shell.tsx`. Proposed: `components/admin-create-rescue-modal.tsx` and shared admin intake form. A0 owns schema/API; this phase changes UI only.

**Dependencies/security/failure.** Requires U0 and A0. Hide sensitive form state from URLs/local storage; warn before discarding unsaved data; failed submission preserves inputs and must not appear in the queue as received.

**Acceptance.** Keyboard and screen-reader users can complete/close/reopen the modal; one admin-assisted request appears once with creator, channel, and provided resident details; direct new-route URL still works; an API/duplicate error leaves the form intact.

**Tests.** Unit: form payload/field mapping. Integration: admin-only intake/idempotency and required identity distinction (A0 suite). Browser: focus/escape/mobile, direct link, validation, duplicate click, success refresh and network failure.

## A4 — Rescue operations and truthful admin surfaces

**Goal.** Turn A0 requests into a usable triage-to-outcome queue linked to the public timeline.

**Tasks**
- [ ] Replace sample array/counts in `components/admin-rescue-requests.tsx` with paginated A0 list/detail, search, priority and workflow filters, locality/age sort, overdue/unassigned indicators, and safe internal export. Show separate case owner and confirmed responder/team.
- [ ] Build detail/actions for triage, priority, assignment/reassignment, notes, dispatch acknowledgment, `en_route`, `on_scene`, completion outcome, cancellation/rejection; send expectedVersion and handle 409 with refresh. Require reasons for terminal/rollback actions; keep internal notes out of public events.
- [ ] Show intake-to-first-triage operational acknowledgment with server time and SLA/overdue policy; connect U5 updates to public-visible A0 events, including stale/reconnect behavior. No status may imply an actual team response without a recorded acknowledgment.
- [ ] Extend existing `AdminNotification`/`AdminAuditLog`/`AdminOperationalAction` only where appropriate; current model existence is **not** notification delivery. Wire persisted in-app notices and unread state, with dedupe and failure handling; decide separately whether external paging/SMS is funded and staffed.
- [ ] Replace fictional rescue/occupancy/alert items in `components/admin-overview-data.ts`, `components/admin-overview.tsx`, `components/admin-live-map.tsx`, `components/admin-notifications.tsx`, and `components/admin-covered-areas.tsx` with real authorized summaries or clear unavailable states. Protect precise rescue points on broadly visible maps.

**Files.** Existing: `components/admin-rescue-requests.tsx`, `components/admin-overview-data.ts`, `components/admin-overview.tsx`, `components/admin-live-map.tsx`, `components/admin-notifications.tsx`, `components/admin-covered-areas.tsx`, `prisma/schema.prisma`. Proposed: `app/admin/rescue-requests/[id]/page.tsx`, `components/admin-rescue-detail.tsx`, queue/notification query helpers and protected export endpoint. A0 owns rescue persistence/endpoints; A4 may extend notification delivery and add export API/UI.

**Dependencies/security/failure.** Needs A0, A3, and U5 to verify both intakes/timelines; A2 supplies honest center state. Minimize private data in list/map/export; full contact and medical details require admin detail authorization. Concurrent dispatch must use A0 versions; retry idempotently; failed refresh shows stale timestamp. Real staffing, duty coverage, escalation and dispatch agreements are external release prerequisites.

**Acceptance.** Public intake appears in the queue; admin status/action is persisted and visible to owner when public; internal note stays internal; two admins cannot silently duplicate dispatch/overwrite assignments; overdue/unassigned counts match database; every preview rescue/occupancy/alert item is removed or clearly unavailable.

**Tests.** Unit: queue/overdue/visibility calculations. Integration: intake→assignment→response→closure, reassignment/races, event privacy, notification dedupe, export authorization. Browser: queue filters/details, multi-admin conflict, requester timeline and stale/reconnect states.

## A5 — Database-backed analytics and matching export

**Goal.** Replace all hardcoded operational numbers, chart points, and CSV with auditable aggregates over real Bulacan records.

**Tasks**
- [ ] Define protected `GET /api/admin/analytics?from&to&localityId&grain` and matching export endpoint with validated ranges/localities, bounded rows, query/index plan, freshness timestamp, and no public cache.
- [ ] Use the same query/filter policy for cards, charts, and CSV; compute `Asia/Manila` bucket boundaries in a documented way, with range metrics separate from current-state snapshots.
- [ ] Replace static `volumeByRange`, `barangays`, `severity`, `metrics`, and `downloadCsv` in `components/admin-analytics.tsx`. Use dynamic axes, zero/partial data states, accessible keyboard tooltips, and responsive charts; remove demo fallback figures from production views.
- [ ] CSV-quote commas/quotes/newlines and neutralize spreadsheet formula prefixes; export only authorized operational aggregates or approved row fields, never routine contact, precise rescue location, or medical/vulnerability data.

**Metric contract**

| Metric | Proposed source/formula and exclusions |
| --- | --- |
| Report volume | Count `FloodReport.createdAt` in selected period/locality; separate all intake from accepted/visible; exclude rejected/archived in public-operational view per A1 policy. |
| Incident volume | Count distinct `Incident.id` created in period; do not sum member reports; define location by representative coordinate and note historical changes. |
| Rescue volume | Count A0 `RescueRequest.createdAt` by priority/status with cancelled/rejected separately; do not use “Rescue Needed” report count as dispatch volume. |
| Verification backlog | Current count of unreviewed/disputed active reports and oldest age as of query time, regardless of selected historical range unless labelled snapshot. |
| Severity/geography | Counts by validated severity and U0 municipality ID; unknown/legacy locality in explicit bucket, no fabricated barangay. |
| Response time | Median and percentile from `received`→first triage/confirmed dispatch/completed A0 event timestamps; omit incomplete intervals and show sample size. |
| Shelter utilization | Only if A2 has reliable, fresh occupancy; otherwise “Unavailable”, never derived from `estimatedCapacity` alone. |

**Files.** Existing: `components/admin-analytics.tsx`, `components/admin-overview-data.ts`, `prisma/schema.prisma`, `lib/admin-auth.ts`. Proposed: `lib/admin-analytics.ts`, `app/api/admin/analytics/route.ts`, `app/api/admin/analytics/export/route.ts`, targeted indexes migration only after query-plan review. UI and protected APIs change.

**Dependencies/security/failure.** Needs A1 report policy, A0/A4 rescue events, A2 center policy, U0 locality IDs. Bound expensive date ranges and avoid N+1/full-table scans; time out gracefully with partial/unavailable indicators rather than demo numbers. Do not expose CSV formula execution or sensitive contact data.

**Acceptance.** Cards/charts/CSV reconcile for the same filters; report and incident counts are distinct; current snapshot metrics are labelled; no-data charts render without divide-by-zero; response times use event timestamps; occupancy is unavailable until A2 data exists.

**Tests.** Unit: bucket boundaries/DST-independent `Asia/Manila` behavior, CSV escaping/formula neutralization, zero-data scales. Integration: seeded fixture reconciliation, filters/auth/pagination and query limits. Browser: range/locality changes, keyboard tooltips, mobile/zero/partial states, downloaded CSV parity.

## A6 — Integration, migration, and rollout

**Goal.** Release only when code, data, and real operations are ready, with reversible rollout controls.

**Tasks**
- [ ] Sequence migrations: U0 scope data/version; A0 rescue schema; U3 email verification; A1 review history; A2 center provenance/import/optional occupancy; A5 indexes. Use expand/backfill/switch/contract, take backup, check `npx prisma migrate status`, and deploy only reviewed migrations. Never run `prisma db push`/demo `db:seed` on production.
- [ ] Add feature flags or configuration gates for verified-registration enforcement, onsite reporting, public rescue intake, admin dispatch controls, and new center feed. Keep old reads compatible during backfill; rollback by disabling new writes/views and restoring backup or forward-fixing schema, not ad hoc destructive down migration.
- [ ] Prepare isolated fixtures for authorization, denied/expired sessions, review races, center CRUD/public sync, rescue lifecycle, notification/external delivery failure, and analytics reconciliation. Remove preview assertions in existing browser tests before enabling production views.
- [ ] Update operator runbook: source provenance/verification cadence, email sender secrets, incident/rescue triage duty schedule, dispatch acknowledgment, privacy retention, escalation, partial provider outages, audit review, and handover.
- [ ] Separate **technical readiness** (tests, migrations, telemetry, backups) from **operational readiness** (official center/contact data, verified email delivery, trained staffed responders, jurisdictional agreements).

**Files.** Existing: `package.json`, `playwright.config.ts`, `tests/integration/README.md`, `docs/admin-phase0-runbook.md`, `README.md`, `prisma/migrations/`. Proposed: new focused unit/integration/browser specs and rollout checklist under `docs/`; no additional product schema/API unless a gate reveals one.

**Dependencies/security/failure.** Requires U6 and all active phases. Isolated `TEST_DATABASE_URL` only for integration fixtures. Backups, migration rehearsals, secrets, alerting, and external responders are explicit release gates; a passing build alone does not authorize real emergency claims.

**Acceptance.** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:integration` with dedicated database, Playwright `tests/browser/`, and `npm run build` pass; migration/backfill rehearsal is documented; rollback gate tested; no preview operational numbers remain; staffing and source sign-offs recorded.

**Tests.** Unit: owning-phase suites. Integration: role/ownership/transaction/competition and analytics fixture suites. Browser: desktop/mobile report, center, registration and complete user-to-admin rescue workflow with failure/reconnect cases; manual operator rehearsal for dispatch and data updates.

## Open decisions and external prerequisites

1. U0 authoritative Bulacan polygon/locality source, license, boundary version and legacy-record display policy.
2. A0 assignment meaning: MVP admin case owner versus a funded/maintained responder team directory or dispatch integration; who may confirm `en_route` and how the team is contacted.
3. U3 verified sender domain/provider, existing-user activation policy, and reliable transactional delivery.
4. A2 official LGU/PDRRMO/MDRRMO/CDRRMO center evidence, current statuses, verification cadence, and whether reliable occupancy can be maintained.
5. A1 public policy for disputed/rejected evidence and incident aggregation; A5 historical backfill/reconciliation rules.
6. Actual Bulacan response staffing, hours, escalation agreements, privacy/retention schedule, and who signs off public “request received” versus “team dispatched” language.

## Final acceptance checklist

- [ ] Admin scope, copy, maps, filters, and new records use U0’s full Bulacan geography and **Flood Watch** brand.
- [ ] A0 is the sole source of rescue truth; requester identity, events, state transitions, idempotency, concurrency and DTO privacy are enforced.
- [ ] Report verification records reviewer/time/reason and is separate from community confirmation and operational resolution.
- [ ] Admin and public evacuation views share one sourced Bulacan center database; stale/unknown availability and occupancy are honest.
- [ ] Admin-assisted modal and public rescue intake feed one live queue; owner-visible events reflect real actions.
- [ ] Overview, maps, notifications, analytics and CSV contain real authorized data or explicit unavailable states, never fictional activity.
- [ ] A6 technical gate and separate real-world source/staffing gate pass before operational release.
