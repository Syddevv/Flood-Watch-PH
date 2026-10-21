# Flood Watch — user-side implementation plan

## Objective and scope

Make **Flood Watch** a Bulacan-wide public service on the existing Next.js 16/React 19/TypeScript, Prisma/PostgreSQL, Leaflet, Open-Meteo, custom-session, and Cloudinary stack. This plan covers province-wide map/report/weather/resource views, evidence-aware flood reporting, verified registration, and a durable user rescue journey. It is a proposal; no phase below is implemented by this document. The admin plan is `docs/admin-side-plan.md`. Preserve historical Calumpit records and technical identifiers that are embedded in cookies, database tables, deployed URLs, or external integrations until separately migrated.

## Baseline implementation and gaps (before U0)

The table below records the original planning snapshot. The U0 and U1 implementation reviews below describe the current scope and weather code.

| State | Verified repository evidence |
| --- | --- |
| Working | `lib/calumpit-boundary.ts` supplies a municipal polygon and map bounds; `lib/report-api.ts` validates new report coordinates; `app/api/reports/route.ts` and `app/api/map/all/route.ts` filter public reports. `app/api/auth/register/route.ts` creates a user and session immediately; `lib/auth-session.ts` and `prisma/schema.prisma` provide database sessions. `components/report-camera-capture.tsx` already uses `getUserMedia`, live preview, capture, retake, and stream cleanup. |
| Partial | `lib/report-location-metadata.ts` records GPS/map/search/manual provenance and treats photo time as descriptive. `components/incident-reports-content.tsx` still offers file selection/drop and optional photos; `app/api/reports/[id]/updates/route.ts` accepts a separate image-update path. `lib/weather.ts` uses Open-Meteo and cached routes under `app/api/weather/`, but searches are biased rather than restricted to the operating area. |
| Static or mismatched | `lib/evacuation-center-scope.ts` selects static centers by a radius around Calumpit; `data/evacuation-centers.ts` also includes out-of-province references. `components/evacuation-centers-content.tsx`, `components/emergency-hotlines-content.tsx`, `lib/constants.ts`, and `components/rescue-request-aside.tsx` consume static resource/contact arrays despite `prisma/schema.prisma` having `EvacuationCenter` and `EmergencyContact` models. |
| Rescue gap | `components/rescue-request-content.tsx` sends “Rescue Needed” to `POST /api/reports`, invents a local RR reference, and prepends it to `SAMPLE_RESCUE_REQUESTS` from `lib/rescue-request-data.ts`; there is no rescue model or requester history in `prisma/schema.prisma`. The existing form in `components/rescue-request-form.tsx` is a useful UI starting point, not a durable dispatch request. |
| Coverage/brand gap | `lib/weather.ts` monitors Metro Manila, Marikina, Quezon City, Manila, Pasig, Cainta, and one Bulacan point. `components/flood-map-client.tsx` and `components/incident-location-picker-map.tsx` use Calumpit-only bounds/overlay. `README.md`, `app/layout.tsx`, `lib/source-metadata.ts`, `prisma/seed.ts`, and many UI strings still say FloodWatch PH or Calumpit. |

Migration history confirms the current foundations: `prisma/migrations/20260826_user_accounts/migration.sql`, `prisma/migrations/20260826_report_capture_metadata/migration.sql`, `prisma/migrations/20260823_incident_grouping/migration.sql`, `prisma/migrations/20260829_evacuation_center_management/migration.sql`, `prisma/migrations/20260829_report_verification/migration.sql`, and `prisma/migrations/20260906_admin_phase0_foundation/migration.sql`. There is no rescue or email-verification migration.

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

The sequence is interleaved: **U5 must follow A0**, and the user rescue journey is incomplete until A4. Shared center persistence/public center APIs belong to **A2**; U4 consumes them. U4 owns contact data/public hotline delivery. U0 owns geographic configuration; neither plan duplicates it.

## U0 — Shared Bulacan scope and Flood Watch branding

**Goal.** Make one sourced provincial geography and locality vocabulary authoritative across server validation and every client view.

**Implementation review (14 October 2026, branch `feat/u0-bulacan-scope-branding`):** Four tasks are implemented. The boundary is licensed and dated but remains indicative; an officially authoritative, redistributable geometry is still needed. See [Bulacan scope provenance, legacy inventory, and display policy](bulacan-scope.md). Unit tests, typecheck, lint, production build, and read-only list/map browser checks passed. Account-creating browser flows and database integration tests remain pending an isolated `TEST_DATABASE_URL` and deployment of the new migration to that database.

**Tasks**
- [ ] Obtain an authoritative, licensed, dated Bulacan Polygon/MultiPolygon and official municipality/city identifiers/labels; store raw source/provenance, version, and simplification method. Retain the Calumpit polygon as a historical reference. **Pending:** the ODbL boundary and PSA identifiers are recorded, but the polygon is not an officially adjudicated boundary.
- [x] Propose `lib/bulacan-scope.ts` and versioned `data/bulacan-boundary.geojson`/`data/bulacan-localities.ts`. Parse GeoJSON [longitude, latitude] once; test MultiPolygon islands, holes, edges/vertices, and invalid coordinates. Use polygon inclusion for eligibility, with bounding boxes only as prefilters.
- [x] Set province center, initial fit bounds, responsive zoom, pan limits, outline/mask, and outside-area messages. Apply to main map, report picker, search/reverse geocoding, nearby queries, admin maps, and `POST /api/admin/reports` as well as public report routes.
- [x] Inventory existing Calumpit and out-of-scope reports/centers; retain records without destructive deletion. Mark legacy scope/version and decide public display policy before changing queries. **Migration prepared; apply during deployment.**
- [x] Rename visible product text, page metadata, auth screens, notification/export labels, help, docs, and appropriate assets to **Flood Watch**. Document retained technical names such as database/cookie keys and deployed hostnames, with migration only if required.

**Files.** Existing: `lib/calumpit-boundary.ts`, `lib/report-api.ts`, `app/api/reports/route.ts`, `app/api/reports/nearby/route.ts`, `app/api/map/all/route.ts`, `app/api/admin/reports/route.ts`, `app/api/reports/reverse-geocode/route.ts`, `app/api/location/search/route.ts`, `components/flood-map-client.tsx`, `components/incident-location-picker-map.tsx`, `components/admin-live-map.tsx`, `app/layout.tsx`, `components/auth/auth-layout.tsx`, `lib/constants.ts`, `README.md`. Proposed: `lib/bulacan-scope.ts`, `data/bulacan-boundary.geojson`, `data/bulacan-localities.ts`, source/provenance note under `docs/`. Schema/migration only if storing scope version or locality ID on records; otherwise no migration. APIs use the same polygon helper; UI shows province bounds and labels.

**Dependencies/security/failure.** This is the shared prerequisite for A0/A2 and U1/U2/U4. Reject new out-of-province writes server-side; never trust a search label or client pin alone. Boundary loading failure must fail closed for writes and show a clear unavailable state for reads; keep historical records accessible to authorized owners/admins.

**Acceptance.** One versioned boundary is used by all named endpoints and maps; fixtures inside each Bulacan municipality/city are accepted, outside points and holes rejected, exact edges have a documented deterministic policy, and no live UI claims nationwide/Calumpit-only coverage.

**Tests.** Unit: geometry/order/hole/edge/locality fixtures (extend `tests/calumpit-boundary.test.ts`). Integration: in/out report, nearby, map, admin-create routes. Browser: map fit/pan, picker/search/outside messaging on desktop/mobile; update `tests/browser/report-flows.spec.ts` and `evacuation-center-scope.spec.ts`.

## U1 — Bulacan-only weather

**Goal.** Restrict all weather surfaces and fallbacks to Bulacan while showing which locality each condition represents.

**Implementation review (14 October 2026, branch `feat/u1-bulacan-weather`):** All four U1 tasks are implemented against U0's indicative polygon. Ten dated locality points, polygon-gated weather routes, versioned caches, bounded point retries, partial-data labels, and distinct model/official copy are documented in [Bulacan weather](bulacan-weather.md). Unit, live development API, production build, and focused production-server browser checks passed. U0's authoritative-boundary prerequisite remains open before release.

**Tasks**
- [x] Replace `MONITORED_LOCATIONS` with a justified, distributed set of Bulacan municipality/city points from U0; label each forecast by locality and never label a single point as province-wide conditions.
- [x] Validate weather coordinates server-side against the polygon before provider calls; filter geocoding results by polygon, not name strings. Audit overview, coordinates, location, sources, search, selected/current location, alerts, sidebar, and degraded responses.
- [x] Version cache keys by boundary/monitored-point set and use appropriate TTL/freshness labels; preserve partial valid localities when an Open-Meteo batch or individual point fails, with bounded retries/provider limits.
- [x] Keep model-derived risk visually and textually separate from dated, attributed official advisories; avoid a national/Metro Manila fallback when Bulacan data is absent.

**Files.** Existing: `lib/weather.ts`, `lib/weather-client.ts`, `lib/weather-api.ts`, `lib/source-metadata.ts`, `app/api/weather/overview/route.ts`, `app/api/weather/coordinates/route.ts`, `app/api/weather/location/route.ts`, `app/api/weather/sources/route.ts`, `app/api/location/search/route.ts`, `components/weather-monitoring-content.tsx`, `components/weather-overview.tsx`, `components/weather-alert-viewer.tsx`. Proposed: `data/bulacan-weather-points.ts`. No schema/migration expected; API validation/caching and UI labels change.

**Dependencies/security/failure.** Depends on U0. Rate-limit and bound provider queries through existing `lib/request-security.ts`; do not cache a degraded reverse-geocode label as an authoritative locality. Partial failure displays last successful timestamp and unavailable localities, not fabricated province totals.

**Acceptance.** All returned locations and accepted coordinates fall inside U0; outside search/current-location requests return an explicit scope response; an overview with one failed provider point retains other valid points with freshness; official warnings remain distinctly sourced.

**Tests.** Unit: polygon filtering, point coverage, cache/fallback policy (`tests/weather-client.test.ts`, `weather-coordinates-cache-policy.test.ts`). Integration: every weather route, provider failure, outside-coordinate rejection (`tests/weather-api.test.ts`). Browser: search, GPS, alerts, stale/partial display on `/weather-monitoring`.

## U2 — Onsite flood reporting

**Goal.** Make new public flood submissions require fresh live camera evidence and a recent, sufficiently accurate GPS fix near the reported Bulacan point, without claiming proof of physical presence.

**Implementation review (17 October 2026, branch `feat/u2-onsite-flood-reporting`):** All five U2 tasks are implemented against U0's indicative polygon. New public submissions require versioned, server-checked camera/GPS evidence; public mutations are text-only; legacy/admin/rescue paths remain distinct; precise fix coordinates are removed from public responses; and the capture-challenge evaluation is documented in [Onsite flood reporting](onsite-reporting.md). Lint, typecheck, 214 unit tests, and the production build passed. The migration, credential-backed integration/browser suites, U0 authoritative geometry, and field validation of the provisional thresholds remain deployment/release prerequisites.

**Tasks**
- [x] Reuse `components/report-camera-capture.tsx` live preview/retake/cleanup; remove new-report file-manager, dropzone, gallery, and camera-failure upload fallbacks. Keep a clear inability-to-submit path when camera or secure context is unavailable.
- [x] Define configurable initial policy for GPS age, accuracy, photo age, and fix-to-report distance from field trials (provisional test values only: 2 minutes, 100 m, 5 minutes, and 150 m plus GPS uncertainty). Record policy version; reject stale/inaccurate fixes and outside/uncertain border points, with a human-review path for legitimate border cases.
- [x] Collect fix timestamp/accuracy and captured evidence metadata; validate both GPS fix and reported point inside U0 and their distance server-side. Map/search/manual edits cannot override proximity. Require image bytes, claimed fix fields, and a valid challenge if adopted on direct API calls; none proves a live camera source. Distinguish legacy report records from newly eligible submissions.
- [x] Evaluate a short-lived, session-bound, single-use server capture challenge, issued before capture and consumed atomically on submission, to reduce replay. Document that it cannot attest camera origin, genuine GPS, or physical presence; claimed device time alone is not proof.
- [x] Audit `PATCH/DELETE /api/reports/[id]`, `POST /api/reports/[id]/updates`, `POST /api/admin/reports`, and rescue intake separately. Define which public location/photo mutations require a new onsite check; allow text-only corrections under ownership rules. Fix the admin-create `locationSource: "admin"` versus current database allowed values as part of the provenance decision.

**Files.** Existing: `components/incident-reports-content.tsx`, `components/incident-report-modal.tsx`, `components/report-camera-capture.tsx`, `components/incident-location-picker.tsx`, `lib/report-api.ts`, `lib/report-location-metadata.ts`, `lib/report-image-validation.ts`, `lib/report-image-browser.ts`, `app/api/reports/route.ts`, `app/api/reports/[id]/route.ts`, `app/api/reports/[id]/updates/route.ts`. Proposed: `lib/onsite-report-policy.ts`, `app/api/reports/capture-challenge/route.ts` if adopted, migration adding server-captured evidence/policy fields and a challenge table. UI removes upload paths; API enforces evidence independently.

**Dependencies/security/failure.** Needs U0, and coordinates with A1’s admin review. Browser GPS, camera frames, client timestamps, and even capture challenges **cannot guarantee physical presence or defeat spoofing**. “Onsite eligible” is a submission rule; “admin verified” is a separate decision. Never expose precise GPS evidence unnecessarily; clean media tracks and temporary uploads after failure.

**Acceptance.** New public reports missing a required image/fix, outside Bulacan, stale/poor fixes, or overly distant pins receive a clear 4xx response even by direct API; fresh nearby reports succeed; legacy reports remain readable and unlabelled as onsite verified; denied permission/HTTPS/upload failure preserves form data.

**Tests.** Unit: threshold boundaries, accuracy radius, challenge expiry/replay, provenance (`tests/report-location-metadata.test.ts`, `report-image-capture.test.ts`). Integration: create/update bypasses, direct multipart requests, one-use challenge, legacy reads (`tests/integration/reports.integration.test.ts`). Browser: fake camera/GPS, pin drag, permissions denied, mobile retake and recovery (`tests/browser/report-camera-capture.spec.ts`, `report-flows.spec.ts`).

## U3 — Registration email verification

**Goal.** Extend existing password and session authentication so newly registered accounts become usable only after verified email ownership.

**Implementation review (17 October 2026, branches `feat/u3-registration-email-verification` and `feat/u3-emailjs-migration`):** All five U3 tasks are implemented. New accounts remain pending until a single-use HMAC-protected code is verified; server-side EmailJS delivery, database-backed abuse controls, pending-session rejection, responsive verification UI, and a separately audited legacy/admin review path are documented in [Registration email verification](email-verification.md). EmailJS API acceptance is tracked without claiming inbox delivery; quota, bounce, and complaint monitoring remain provider-side limitations. Lint, typecheck, 237 unit tests, two focused desktop/mobile browser tests, Prisma validation, and an isolated Vercel-style production build passed. Five PostgreSQL integration tests were discovered but skipped because no isolated `TEST_DATABASE_URL` is configured. Applying the existing migration, configuring EmailJS in each Vercel environment, manually validating delivery, and reviewing legacy accounts remain deployment prerequisites.

**Tasks**
- [x] Add pending registration state, verified timestamp, code hash/key ID, expiry, attempts, resend-after, and consumed timestamp in a new migration; retain existing `User`/`Session` and `lib/password.ts`. Choose a cryptographically random code with keyed hashing/equivalent secure storage and rotate keys safely.
- [x] Change registration to create a pending account without a normal session. Add request-verification, verify-code, and resend routes; consume a code atomically once, activate account, then issue a session. Enforce code lifetime, attempt cap, resend cooldown, per-email and trusted-IP rate limits, generic responses, and no code/token logs.
- [x] Add pending, sent, expired, resend, success, and delivery-failure UI in `app/register/page.tsx` and a proposed verification page. Login returns an actionable unverified state without exposing whether arbitrary email addresses exist; `lib/auth-session.ts` and protected APIs reject pending sessions.
- [x] Review existing users rather than silently treating all as verified. Audit existing administrators and activate verified ones through a controlled, logged migration; define legacy-user notification/grace and session revocation before enforcement.
- [x] Configure EmailJS service/template/secrets and bounded API-acceptance telemetry. Selected server-only variables: `EMAIL_PROVIDER`, `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY`, and `EMAIL_VERIFICATION_HMAC_KEY`; retain `NEXT_PUBLIC_APP_URL` as the deployed origin. Gmail/EmailJS quotas and delivery failures beyond API acceptance remain provider-side operational monitoring responsibilities.

**Files.** Existing: `prisma/schema.prisma`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/auth/session/route.ts`, `lib/auth-session.ts`, `lib/password.ts`, `lib/request-security.ts`, `app/register/page.tsx`, `app/login/page.tsx`, `components/auth-session-provider.tsx`. Proposed: `app/api/auth/verify-email/route.ts`, `app/api/auth/resend-verification/route.ts`, `app/verify-email/page.tsx`, `lib/email-verification.ts`, `lib/email-delivery.ts`, one Prisma migration. API and UI states change; existing role model remains.

**Dependencies/security/failure.** Can start after U0 independent of A0, but U5 release must use its verified-account gate. Delivery failure leaves a recoverable pending state; secrets and codes never enter analytics/logs. Enforce trusted origin and database-backed rate limits; avoid account enumeration.

**Acceptance.** Pending registration cannot submit a report/rescue request; one valid code activates exactly once; expired/wrong/replayed codes fail without activation; resend cooldown and attempt limits work; reviewed existing admins retain access after rollout.

**Tests.** Unit: code hash/expiry/attempt/cooldown and legacy-state policy. Integration: register→verify→session, wrong/replay/race, resend, email-provider failure, current-admin migration (`tests/integration/auth.integration.test.ts`). Browser: pending/success/error/resend and protected-route navigation on desktop/mobile.

## U4 — Bulacan evacuation centers and emergency contacts

**Goal.** Give residents province-wide, sourced resource information backed by the same center records admins manage.

**Implementation review (18 October 2026, branch `feat/u4-bulacan-resources`):** The sourced directory importer, public center/contact views, map handling for located facilities, and protected admin corrections are implemented. Public reads exclude demo/out-of-province contacts without deleting existing database rows. National contacts, if present and sourced, appear in a separate fallback group. See [rollout and limitations](bulacan-emergency-directory.md). The migration and import have **not** been run against a database in this workspace; deployment and database integration checks remain pending.

**Tasks**
- [x] Consume **A2-owned** canonical public center API/backfill; remove `NEARBY_EVACUATION_CENTERS` as coverage gate from lists, map, cards, detail, featured, and filters. Use nearest distance only for ordering from the viewer’s point, with a municipality/city selector and explicit no-records gaps.
- [x] Show source URL, verified date, verification state, archived/stale state policy, and “availability unknown” distinctly from operationally confirmed availability; never infer occupancy from estimated capacity.
- [x] Own contact-data audit and delivery: inventory `EmergencyContact` database rows plus `lib/constants.ts`, `components/emergency-hotlines-content.tsx` quick contacts, `components/rescue-request-aside.tsx`, dashboard panels, and seed/fallback arrays. Import only verified Bulacan provincial/LGU/PDRRMO/MDRRMO/CDRRMO contacts with source URLs and verification dates; deduplicate and remove demo/out-of-province entries. Decide whether applicable national numbers remain in a clearly separate fallback group.
- [x] Expose a bounded public `GET /api/emergency-contacts` and admin-maintained/controlled import path for verified updates; show last-checked dates and unknown/missing contacts rather than inventing values.

**Files.** Existing: `components/evacuation-centers-content.tsx`, `components/evacuation-center-card.tsx`, `components/flood-map-client.tsx`, `components/dashboard-shell.tsx`, `components/emergency-hotlines-content.tsx`, `components/rescue-request-aside.tsx`, `lib/constants.ts`, `lib/evacuation-center-scope.ts`, `data/evacuation-centers.ts`, `prisma/seed.ts`, `prisma/schema.prisma`. Proposed: `app/api/emergency-contacts/route.ts`, `lib/emergency-contact-policy.ts`, audited contact import script and migration for contact provenance/verification fields. Center schema/API/import are owned by A2.

**Dependencies/security/failure.** Needs U0 and A2 center API. Official LGU/PDRRMO/MDRRMO/CDRRMO source URLs and verification dates are external prerequisites; unsourced entries remain unpublished or labelled references. Archive and stale records cannot surface as open verified centers. Public DTOs omit internal admin notes.

**Acceptance.** Every Bulacan municipality/city can be selected, including those with zero sourced centers; no radius excludes a valid provincial record; admin center changes appear on public list/map/detail after refresh; all displayed contacts have recorded source/date or are explicitly unavailable; out-of-province demos are absent.

**Tests.** Unit: municipality filters, nearest sort, stale/unknown semantics, contact dedupe. Integration: A2 center CRUD→public synchronization, archived filtering, contact imports/API. Browser: province filters, map/detail/nearest, no-data and stale labels, quick-access and rescue-aside contacts.

## U5 — Durable user rescue request experience

**Goal.** Connect the existing discoverable `/rescue-request` form and “My Rescue Requests” view to A0’s protected rescue API and A4’s operations timeline.

**Tasks**
- [x] Replace `POST /api/reports` and local random RR IDs with A0 `POST /api/rescue-requests`; preserve form values on recoverable failure and send an idempotency key to prevent duplicate submissions.
- [x] Capture requester/contact details, people count, vulnerability needs, situation, precise incident location plus municipality/barangay, whether the request is for self or another person, and optional linked flood report. Verify any linked report is readable by the requester or explicitly allowed.
- [ ] Keep rescue photos optional and emergency location behavior separate from U2 onsite rules; allow map/manual place description when GPS/camera fails, with clear uncertainty shown to admin. Explain that submission creates a request, not guaranteed dispatch. **Remaining:** the A0 contract has no private photo storage, so the old public-URL photo control is disabled until secure owner/admin-only storage is available.
- [x] Replace sample cards/timeline with owner-only paginated `GET /api/rescue-requests` and detail; show server reference ID, acknowledgment, status/event timestamps, safe requester corrections, and cancellation rules from A0. Use bounded polling with focus/reconnect refresh and stale-state indicator for Vercel; stop polling after terminal state.
- [x] Remove wording implying automatic routing to the nearest available team, preexisting dispatch, or a guaranteed response.

**Files.** Existing: `components/rescue-request-content.tsx`, `components/rescue-request-form.tsx`, `components/rescue-request-card.tsx`, `components/rescue-request-aside.tsx`, `lib/rescue-request-data.ts`, `lib/rescue-request-form.ts`, `app/rescue-request/page.tsx`. Proposed: `app/rescue-request/[id]/page.tsx` and client fetch/poll helper under `lib/`. A0 owns schema, migration, validation, and rescue endpoints; U5 changes public UI only.

**Dependencies/security/failure.** Needs A0 and U0; release with U3 verified-account enforcement and A4 staffed workflow. Owner checks belong to A0. Do not put contact, precise coordinates, or medical/vulnerability details in public caches, URLs, telemetry, or general map markers. A failed refresh keeps last known data visibly stale.

**Acceptance.** A verified user can file once, reload and see the same server ID/status, open own detail, and observe an A4 status update; another user gets 403/404 without private data; duplicate retries return the same request; cancel/update follow A0 rules; receipt never says dispatched before a dispatch event exists.

**Tests.** Unit: form serialization, status labels, polling/reconnect and error preservation (`tests/rescue-request-form.test.ts`, `rescue-request-data.test.ts`). Integration: A0 owner/duplicate/detail/update/cancel flows. Browser: file→reload→timeline update, duplicate click, denied GPS, outage/stale UI, cross-account isolation (`tests/browser/rescue-request.spec.ts`).

## U6 — User-to-admin end-to-end acceptance

**Goal.** Verify the complete public journey against deployed-like data, including admin actions, before a release decision.

**Tasks**
- [ ] Run cross-phase fixtures for every Bulacan locality plus outside/hole/edge cases, weather provider partial failures, onsite camera/GPS policy, pending/verified registration, centers/contacts, and rescue intake through A4 completion. **Partial:** Existing unit tests cover all 24 locality points and geometry cases; a real resident-to-admin completion browser flow is written but awaits isolated PostgreSQL execution.
- [ ] Review public copy and browser accessibility on phone/desktop, especially emergency disclaimers, stale data, status wording, camera/GPS failures, and unverified-resource warnings. **Partial:** Sixteen focused browser cases pass, including phone layout, resource details, outage copy, and rescue status wording; full manual review remains.
- [ ] Compare public report/incident/rescue counts and timelines with A1/A4/A5; check rejected/archived privacy and legacy Calumpit visibility. **Remaining:** Run a combined staging fixture and reconcile all counts and privacy views.
- [x] Create an operator sign-off record for authoritative geometry, verified resource/contact data, email delivery, and real responder coverage; carry unresolved gaps into A6 rollout gate. Record: `docs/u6-acceptance-record.md`. Every external sign-off remains pending; this checkbox records the gate, not approval.

**Files.** Existing: `tests/browser/report-flows.spec.ts`, `tests/browser/rescue-request.spec.ts`, `tests/browser/evacuation-center-scope.spec.ts`, `tests/integration/reports.integration.test.ts`, `tests/integration/auth.integration.test.ts`, `README.md`. Proposed: focused cross-flow browser/integration specs and updated user-facing operating guidance under `docs/`. No new schema/API; UI fixes are fed back to owning phases.

**Dependencies/security/failure.** Requires U0–U5 plus A0/A1/A2/A4. Test against isolated `TEST_DATABASE_URL` per `tests/integration/README.md`; do not seed or mutate production. Emergency workflow is not operationally ready until staffing/dispatch arrangements are confirmed.

**Acceptance.** Every U0–U5 criterion passes in a staging-like environment; a submitted rescue request appears in the admin queue and the user timeline reflects actual admin events; no sample data is displayed as live.

**Tests.** Unit: owning-phase suites. Integration: `npm run test:integration` on dedicated PostgreSQL. Browser: Playwright `tests/browser/` with camera/geolocation stubs plus manual mobile-device checks; also run `npm run lint`, `npm run typecheck`, `npm run test`, and `npm run build`.

## Open decisions and external prerequisites

1. Obtain and license a dated authoritative Bulacan geometry/locality dataset; decide exact-edge and coastal/island handling, and how legacy out-of-scope records are shown.
2. Field-test U2 GPS/photo thresholds and border-review workflow; decide whether the capture challenge is worth its complexity. Browser evidence cannot establish physical presence.
3. Choose a transactional email provider, verified production sender domain, deliverability monitoring, and policy for existing unverified users/admins.
4. Obtain official, dated center/contact sources for every Bulacan locality; record gaps rather than fabricate data. Decide national fallback contact display.
5. Confirm real rescue desk hours, responder staffing, dispatch acknowledgment, escalation contacts, and data-retention/privacy policy before presenting operational service.

## Final acceptance checklist

- [ ] Product text says **Flood Watch** and operational scope is the whole **province of Bulacan**; technical-name exceptions are documented.
- [ ] One sourced polygon/locality configuration drives server writes, public/admin maps, search, and location selection.
- [ ] Weather search, current location, alerts, provider fallbacks, and monitored points remain inside Bulacan with fresh/source labels.
- [x] New public flood reports require server-checked onsite eligibility; legacy reports are not mislabelled; admin verification remains separate.
- [x] New registrations require email verification before normal authenticated privileges; existing-account migration is audited.
- [ ] All public centers/contacts are sourced, dated, province-wide, and center views share A2’s database.
- [ ] Rescue requests have durable owner-only IDs/history and real admin-to-user updates; emergency claims match confirmed operations.
- [ ] U6 and A6 gates pass before release.
