# FloodWatch PH Admin Backend Integration To-Do List

## Goal

Complete the Calumpit Emergency Operations Center admin workflow by connecting the admin interface to durable PostgreSQL data, secure APIs, and operational history. Keep the existing database-backed authentication and administrator role model.

## Scope Decisions

- [ ] Keep the existing `User`/`Session` authentication flow and `admin:promote` CLI.
- [x] Defer the Users & Roles page and user-management APIs from this release. Existing registration and the `admin:promote` CLI remain available.
- [x] Defer the Audit Logs page and audit-log search/export APIs from this release. Existing `AdminAuditLog` writes remain enabled for future use.
- [ ] Build persisted in-app notifications first; defer email, SMS, and push delivery.
- [x] Defer a distinct `RescueRequest` entity and public rescue-request intake until the public users screen supports rescue requests. For this release, keep rescue handling within the existing flood-report workflow.

## Current-State Baseline

- [x] Confirm `User`, `Session`, `FloodReport`, `Incident`, `EvacuationCenter`, `ReportUpdate`, and `AdminAuditLog` Prisma models exist.
- [x] Confirm server-side admin guards exist for admin pages and APIs.
- [x] Confirm report list/detail and verification endpoints exist.
- [x] Confirm evacuation-center list/create/update/archive/restore endpoints exist.
- [x] Confirm report and center validation helpers exist.
- [ ] Replace preview/static operational data in overview, rescue requests, analytics, notifications, and settings.
- [ ] Replace placeholder admin forms and incomplete action controls with working workflows.

## Phase 0: Contracts, Conventions, and Database Foundation

### API and service conventions

- [x] Define a stable admin response envelope: `{ data, error, requestId }` in `lib/admin-api-response.ts`.
- [x] Define the standard `401`, `403`, `400`, `404`, `409`, `429`, and `500` behavior for admin routes; route-by-route adoption continues with each feature endpoint.
- [x] Add request-ID generation/propagation helper for admin responses in `lib/admin-api-response.ts`.
- [x] Move the report-verification mutation into `lib/admin-action-service.ts`; remaining mutation extraction will continue with each feature workstream.
- [x] Add shared pagination parsing and the canonical admin report DTO serializer in `lib/admin-contracts.ts` and `lib/admin-report-dto.ts`; broader query consolidation remains.
- [x] Ensure the canonical admin report/session DTOs never expose password hashes, session token hashes, service keys, or internal notes.
- [x] Define seed, archive/restore, notification-read, and repeated-action idempotency expectations in `docs/admin-phase0-runbook.md`.

### Prisma migrations

- [x] Define an explicit admin response status vocabulary: `pending`, `under_review`, `verified`, `responding`, `resolved`, `rejected`, and `closed` in `lib/admin-contracts.ts`.
- [x] Document mappings between admin response status and existing public report/incident lifecycle strings in `lib/admin-contracts.ts`.
- [x] Add report/incident action history with target, actor, previous value, next value, action type, visibility, note, request ID, and timestamps through `AdminOperationalAction`.
- [ ] (Deferred) Add a `RescueRequest` model with requester, location, description, optional evidence, priority, status, assignment, linked report/incident, and lifecycle timestamps after the public rescue module exists.
- [ ] (Deferred) Add `RescueRequestAction` history for status, assignment, notes, and acknowledgements after the public rescue module exists.
- [x] Add `AdminNotification` with type, safe detail, target, priority, recipient/scope, read state, acknowledgement state, dedupe key, and timestamps.
- [x] Add `AdminSetting` as a constrained key/value model for approved operational settings.
- [x] Add `updatedByUserId` provenance to evacuation-center changes.
- [x] Add indexes for operational action targets/actors, notification priority/recipient/target, and existing report/center filters.
- [x] Add database constraints for supported action visibility/types and notification priorities.
- [x] Create deterministic seed fixtures for reports, incidents, action history, notifications, and settings. Rescue-request fixtures remain deferred with the module.
- [x] Apply the Phase 0 migration to the configured Supabase PostgreSQL database (`20260906_admin_phase0_foundation`).
- [ ] Test migration rollback/rehearsal against a staging database before production releases (runbook added; staging execution requires the staging database).

## Phase 1: Admin Authentication and Authorization Hardening

- [ ] Test `/api/admin/session` end-to-end for unauthenticated, regular-user, and admin requests (requires an authenticated test database).
- [x] Verify admin page redirects use constrained local `next` paths; safe redirect behavior is covered by tests.
- [x] Reject non-admin users with `403` through the centralized `requireAdminApi` guard.
- [x] Validate and constrain `next` redirects to prevent open redirects.
- [x] Apply trusted-origin/`Origin` checks through the reusable protected-admin guard.
- [x] Add protected-admin rate limits for report reads/detail/verification and evacuation-center list/create routes.
- [ ] Apply the protected-admin guard to remaining center archive/restore/update routes and future admin mutations.
- [x] Add pure coverage for missing/revoked and expired session state in `tests/auth-session-state.test.ts`.
- [ ] Add browser/integration coverage for full signed-out, regular-user, expired-session, and revoked-session admin access against a test database.

## Phase 2: Flood Report Management and Verification

### Report list and table

- [x] Make `GET /api/admin/reports` use database-backed filtering, sorting, and pagination with a stable ID tie-breaker.
- [ ] Support filters for verification status, public lifecycle status, severity, incident, date range, location, title, description, and reporter.
- [x] Return paginated report results and summary counts without loading the entire report result set into application memory.
- [ ] Add loading, empty, invalid-filter, retry, and pagination states to the report list.
- [x] Update the flood report table column header from **"Assignee"** to **"Reporter"**.
- [x] Ensure the Reporter cell displays the authenticated reporter name/email or a clear legacy-anonymous label.
- [ ] Display report ID, priority/severity, public status, verification status, location, incident association, photo availability, reporter, created time, and last activity.
- [ ] Ensure row actions open the complete report detail view.

### Create flood report modal

- [ ] Create a reusable admin modal form for creating a new flood report.
- [ ] Include title, description, category, severity, location name, latitude, longitude, location source, optional photo, reporter display information, and rescue-needed selection.
- [ ] Provide map/location-picker support and enforce the Calumpit boundary server-side.
- [ ] Validate required fields, coordinate ranges, text lengths, severity/category allow-lists, and image constraints.
- [ ] Submit through an admin-authorized endpoint with the authenticated actor recorded separately from the reporter.
- [ ] Create or attach the correct incident within a transaction.
- [ ] Refresh the report list, overview counts, map, and notifications after creation.
- [ ] Handle duplicate submissions, API validation errors, upload failures, and stale modal state.

### Report detail and verification

- [x] Extend `GET /api/admin/reports/:id` to return safe reporter data, incident context, related reports, verification history, response history, and notes.
- [x] Improve the verification workflow with explicit confirmation before destructive/reputational transitions.
- [ ] Validate allowed verification transitions: `unreviewed`, `verified`, `disputed`, and `rejected`.
- [ ] Define how verification changes affect public visibility, incident aggregation, and response status.
- [ ] Add `PATCH /api/admin/reports/:id/verification` transaction logic for the report update, history record, and notification.
- [x] Add `PATCH /api/admin/reports/:id/status` with the documented transition matrix, optimistic concurrency, transaction history, and audit record.
- [x] Add `POST /api/admin/reports/:id/notes` for internal notes and optional public response/action notes.
- [ ] Add report assignment/unassignment only if an operational assignee is required; keep the list column label as Reporter.
- [x] Add resolve/close actions with required resolution context and timestamps.
- [ ] Prevent users from modifying admin-only status, verification, assignment, and internal notes.
- [x] Add optimistic concurrency using `updatedAt` or a version field and return `409` on stale writes.
- [ ] Preserve rejected/closed records and their full history for administrative review.
- [ ] Update the public map/API serialization only with fields intended for public display.

### Incident-level management

- [ ] Add incident detail/status/history endpoints where an action applies to a grouped incident.
- [ ] Allow administrators to review duplicate/same-location reports under one incident.
- [ ] Keep incident report counts and last-activity timestamps transactionally consistent.
- [ ] Ensure incident status changes are reflected in report detail and admin overview data.

## Phase 3: Evacuation-Center Management

### Create center modal

- [ ] Create a reusable modal form for adding an evacuation center.
- [ ] Include name, description, address, barangay, city, province, region, coordinates, contact number, facilities, capacity, status, verification status, source type/name/URL, and notes.
- [ ] Provide location selection and coordinate validation.
- [ ] Validate facility allow-list, URL format, capacity as a non-negative integer, and field length limits.
- [ ] Save through `POST /api/admin/evacuation-centers` and record the actor/provenance.
- [ ] Refresh the center list, map markers, capacity summaries, and relevant notifications after creation.

### Edit/manage center modal and detail page

- [ ] Create a reusable modal form for editing an evacuation center.
- [ ] Load current values from `GET /api/admin/evacuation-centers/:id` before editing.
- [ ] Submit an explicit field allow-list through `PATCH /api/admin/evacuation-centers/:id`.
- [ ] Add verification-status actions and automatically manage `lastVerifiedAt` rules.
- [ ] Add status update controls for available, standby, temporarily unavailable, and needs verification.
- [ ] Add operational notes and source/provenance editing where allowed.
- [ ] Add confirmation dialogs for archive and restore.
- [ ] Make archive/restore idempotent and return `409` for stale concurrent edits.
- [ ] Ensure archived centers are excluded from public center lists while remaining visible to admins.
- [ ] Replace placeholder "Add center", "Update status", "Add operational note", and "More actions" controls.
- [ ] Add loading, validation, conflict, success, and error states for all modal actions.

## Phase 4: Rescue Request Backend and Management Page (Deferred)

Defer this entire phase until the public users screen has a rescue-request module. For the current release, "Rescue Needed" continues through the authenticated flood-report workflow.

### Rescue-request data and intake

- [ ] (Deferred) Decide whether to expose a distinct authenticated `POST /api/rescue-requests` intake or migrate the existing "Rescue Needed" report flow into `RescueRequest`.
- [ ] Require authentication and derive requester identity from the session; never accept a client-supplied user ID.
- [ ] Capture location, description, request timestamp, urgency, optional photo evidence, affected people/details, and contact context approved by product/privacy review.
- [ ] Enforce Calumpit coordinates, payload limits, image validation, and per-user/IP rate limits.
- [ ] Link a rescue request to a flood report/incident when appropriate.

### Create rescue-request modal

- [ ] Create a modal form for administrators to create a rescue request when intake is needed from the EOC.
- [ ] Include requester details, location picker, priority, description, optional evidence, and linked report/incident.
- [ ] Validate the form on the server and record the creating admin separately from the requester.
- [ ] Create the request, initial history record, and urgent notification in one transaction.
- [ ] Refresh rescue list, overview counters, map markers, and unread notifications after creation.

### Rescue-request API

- [ ] Add `GET /api/admin/rescue-requests` with priority, status, search, location, date, assignment, and pagination filters.
- [ ] Add `GET /api/admin/rescue-requests/:id` with safe requester data, location, evidence, linked records, and action history.
- [ ] Add `PATCH /api/admin/rescue-requests/:id/status` with the transition matrix: pending, acknowledged, assigned, responding, resolved, cancelled, closed.
- [ ] Add `PATCH /api/admin/rescue-requests/:id/assignment` for assign/unassign actions.
- [ ] Add `POST /api/admin/rescue-requests/:id/notes` for internal response notes.
- [ ] Add acknowledge, resolve, cancel, and close semantics with timestamps and required context.
- [ ] Use optimistic concurrency and transactionally write status/assignment/history/notifications.
- [ ] Restrict requester endpoints to the requester or an admin.

### Rescue-request management page

- [ ] Create the `/admin/rescue-requests` page using live API data instead of static preview rows.
- [ ] Display ID, emergency priority, status, summary, location, requester, assignee, created time, updated time, and action controls.
- [ ] Add search, priority/status filters, pagination, empty state, loading state, and retry state.
- [ ] Create a detail view or detail modal for full request information and history.
- [ ] Add status, assignment, acknowledge, note, resolve, cancel, and close controls.
- [ ] Highlight emergency requests and prevent accidental closure without confirmation.
- [ ] Ensure the page updates unread counts and related overview/map state after mutations.

## Phase 5: Live Overview, Map, and Analytics

- [ ] Add `GET /api/admin/overview` for active reports/incidents, verification queue, urgent/emergency rescues, center capacity, advisory state, recent actions, and needs-attention items.
- [ ] Add `GET /api/admin/map` for admin-scoped reports, incidents, rescue requests, and centers with admin status fields.
- [ ] Add `GET /api/admin/analytics` with bounded time ranges for report/rescue/incident volume, severity, status, barangay, and center utilization.
- [ ] Use database aggregates and indexes instead of hard-coded preview arrays.
- [ ] Replace `dataMode: preview` with `dataMode: live` when all required sources are available.
- [ ] Add explicit partial-data and source-error states instead of silently showing fabricated values.
- [ ] Verify public/admin geographic rules remain distinct: reports within Calumpit, nearby centers within the supported radius.
- [ ] Refresh overview/map data after report, rescue, and center mutations.

## Phase 6: Persisted Notifications

- [ ] Add `GET /api/admin/notifications` with unread filter and pagination.
- [ ] Add unread-count support for the admin shell.
- [ ] Add read and mark-all-read mutations that persist across reloads and devices.
- [ ] Add optional acknowledge state for notifications representing an operational handoff.
- [ ] Generate notifications for new reports, verification thresholds, emergency rescues, center capacity warnings, and relevant status changes.
- [ ] Add dedupe keys and retention rules to prevent notification spam.
- [ ] Ensure notification detail excludes unnecessary personal information.
- [ ] Replace local notification state in `AdminNotifications` with API state.

## Phase 7: Persisted Administration Settings

- [ ] Add `GET /api/admin/settings` and `PATCH /api/admin/settings`.
- [ ] Allow-list operations-center name, public advisory footer, notification toggles, and approved thresholds only.
- [ ] Validate lengths, values, and cross-setting constraints.
- [ ] Record the updating admin and timestamp.
- [ ] Replace local state in `AdminSettings` with persisted values and save/error/conflict states.
- [ ] Apply settings to the admin shell, overview, notification generation, and approved public advisory surfaces.
- [ ] Do not store secrets or executable configuration in settings.

## Phase 8: Security and Reliability Hardening

- [ ] Rotate any database, Supabase, Cloudinary, or other credentials that have been exposed outside the deployment secret store.
- [ ] Enforce maximum request sizes and safe text/URL lengths on all new endpoints.
- [ ] Validate uploaded evidence server-side and do not trust client MIME types.
- [ ] Use transactions for every state-plus-history-plus-notification mutation.
- [ ] Add database query-plan checks for report, rescue, center, overview, and analytics queries.
- [ ] Add timeout/bounded-range protection for analytics and export operations.
- [ ] Avoid logging report descriptions, contact data, photos, or precise personal details unless required.
- [ ] Define retention policies for notifications, operational notes, and uploaded evidence.
- [ ] Document operational rollback steps for each migration and major release.

## Phase 9: Testing Checklist

### Unit tests

- [ ] Test report, incident, rescue-request, and center validation.
- [ ] Test status-transition matrices and public-status mapping.
- [ ] Test boundary/radius rules and capacity validation.
- [ ] Test notification deduplication and unread-count calculations.
- [ ] Test DTO serialization excludes sensitive fields.

### Integration tests

- [ ] Test every admin endpoint for `401`, `403`, success, validation failure, missing record, stale update, rate limit, and database failure.
- [ ] Verify report verification/status/note actions create exactly one history record and expected notifications. (Status/verification history is implemented; integration database coverage remains.)
- [ ] Verify rescue requester ownership, lifecycle, assignment, and history.
- [ ] Verify center create/edit/verify/archive/restore and public visibility.
- [ ] Verify modal create flows for flood reports, rescue requests, and evacuation centers.
- [ ] Verify settings persistence and allow-list enforcement.

### Browser tests

- [ ] Test admin login, safe redirect, and logout.
- [ ] Test the create-flood-report modal, validation, submission, and list refresh.
- [ ] Test report verification/status/note/resolve flows and the Reporter column.
- [ ] Test create/edit/manage evacuation-center modals and archive/restore.
- [ ] Test rescue-request management page, detail view, priority filters, assignment, notes, and closure.
- [ ] Test persisted notifications and mark-all-read after reload.
- [ ] Test live overview/map/analytics loading and partial-error states.
- [ ] Test signed-out and regular-user denial for all admin pages and APIs.
- [ ] Test desktop and mobile modal layouts, focus handling, escape/cancel behavior, and keyboard accessibility.

### Release checks

- [x] Run `npm run lint`.
- [x] Run `npm run typecheck`.
- [x] Run unit and integration test suites.
- [x] Run `npm run build`.
- [ ] Validate migrations and rollback on staging.
- [ ] Verify production environment variables without printing secret values.
- [ ] Capture latency and error rates for the highest-volume admin endpoints.

## Delivery Order

- [x] Phase 0 repository implementation: contracts, migrations, indexes, fixtures, shared helpers, canonical DTOs, service extraction, and admin-route response adoption.
- [ ] Phase 0 operational follow-up: staging rollback rehearsal, production environment verification, and endpoint latency capture.
- [ ] Phase 1: authentication/authorization hardening. (Core guard, origin checks, rate limits, request-ID logging, and session-state tests are implemented; database/browser coverage remains.)
- [ ] Phase 2: flood-report creation modal, list/detail integration, verification, status, notes, and resolution. (List pagination, Reporter label, verification history, status endpoint, detail history, notes, and resolution controls are implemented; creation modal and integration coverage remain.)
- [ ] Phase 3: evacuation-center create/edit/manage modals and persistence.
- [ ] Phase 4: rescue-request model, create modal, APIs, and management page (after the public rescue-request module exists).
- [ ] Phase 5: live overview, map, and analytics.
- [ ] Phase 6: persisted notifications.
- [ ] Phase 7: persisted settings.
- [ ] Phase 8: security/reliability hardening.
- [ ] Phase 9: automated, browser, mobile, staging, and release verification.

## Definition of Done

- [ ] No in-scope admin page depends on hard-coded operational records.
- [ ] Admins can create, review, verify, update, annotate, resolve, and close flood reports with persisted history.
- [ ] The flood report table uses **Reporter**, not **Assignee**, for the reporter column.
- [ ] Admins can create, edit, verify, archive, and restore evacuation centers through modal forms.
- [ ] Admins can create, view, assign, update, annotate, resolve, cancel, and close rescue requests through the management page.
- [ ] Public map/list behavior reflects approved operational state without exposing internal data.
- [ ] Notifications and settings persist across reloads.
- [ ] All admin mutations enforce authorization, validation, rate limits where applicable, transactions, and stale-write protection.
- [ ] Required tests, build checks, migration rehearsal, and release checks pass.
- [x] Users & Roles, Audit Logs, and the standalone rescue-request module remain explicitly deferred and are not release blockers for this scope.
