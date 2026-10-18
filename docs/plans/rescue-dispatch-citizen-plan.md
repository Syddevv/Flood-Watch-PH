# Admin-managed rescue dispatch: citizen experience plan

**Status:** Planning only, 18 October 2026. This plan depends on the [admin and shared-data plan](rescue-dispatch-admin-plan.md). No phase has started. Flood Watch is a capstone simulation, not an emergency dispatch service. Public copy must state that status is an admin-recorded simulation and must not promise actual responder availability or arrival.

## Current architecture and functionality to preserve

| Area | Current implementation | Keep working |
| --- | --- | --- |
| Intake | `components/rescue-request-content.tsx`, `rescue-request-form.tsx` and `/rescue-request` submit persistent `RescueRequest` through `POST /api/rescue-requests` with an idempotency key. `lib/rescue-contracts.ts` validates Bulacan locality/coordinates and required details. | Verified-session intake, manual location fallback, form values after recoverable errors, stable server reference; no photo dependency. |
| Tracking | `GET /api/rescue-requests` and `[id]` return owner-scoped history; `components/rescue-request-detail.tsx` shows status/events and supports corrections/cancellation. `lib/rescue-request-client.ts` maps labels and terminal polling. List/detail refresh on focus/reconnect, with stale indicator. | Ownership, pagination, refresh behavior, honest “request is not guaranteed dispatch” copy. |
| Data/privacy | `lib/rescue-dto.ts` filters internal events and hides actor/case-owner IDs from public response. It currently returns `confirmedTeamReference` and `outcome` in both admin/public DTOs; public events expose selected status/priority and public notes. | Owner-only access, public/internal event distinction, current request ID and timestamps; tighten projection for new private assignment fields. |
| Auth/alerts | Public API requires authenticated, verified users for intake and ownership for reads/edits. `AdminNotification` persists notices but `app/api/admin/notifications` is admin-only. New request already alerts admins. | Existing session/origin/rate-limit conventions and admin notice delivery; do not claim citizen push exists today. |
| Tests | `tests/rescue-request-form.test.ts`, `tests/rescue-request-data.test.ts`, `tests/integration/rescue.integration.test.ts`, `tests/browser/rescue-request.spec.ts`. | Existing intake, ownership, correction, cancellation, refresh and timeline regressions. |

The older `docs/user-side-plan.md` contains a pre-foundation audit that says rescue data is simulated in the browser; current code now persists it. Use current code and migrations as truth. The new responder organization/assignment models are owned by the admin plan; this plan does not create another request or public responder system. Read relevant `node_modules/next/dist/docs/` guides before Next code edits, per `AGENTS.md`.

## Dependencies and six-phase map

| Phase | Citizen impact and planned work | Gate |
| --- | --- | --- |
| 1. Data foundation | Inspect and preserve public request/owner API. Event metadata is added by admin/shared plan; no new citizen behavior. | Review migrated records, owner tests. |
| 2. Coordination | Admin records contacts/acknowledgement; internal attempt data stays private. | Verify public DTO does not leak contact details. |
| 3. Lifecycle | Agree on new public projection for status and exceptional outcomes; legacy statuses remain intelligible. | Admin state machine and event semantics stable. |
| 4. Admin UI | Keep existing public tracking while admin UI changes; test one request across both views. | Queue/detail actions stable. |
| 5. Citizen tracking | Implement status labels, timeline, safe updates and in-app notices. | Owner API/public event contract from phases 1–4. |
| 6. Proof/demo | Full citizen-to-admin scenario, privacy checks and simulated demo copy. | Phase 5 complete. |

Each approved phase uses a new branch. After implementation, check its completed boxes, report changed files, DB/rollback, behavior, compatibility, actual tests, issues and next phase, then wait for approval. Nothing below is marked complete by this planning document.

## Data and public API contract

**Database:** Reuse `RescueRequest`, `RescueRequestEvent` and their IDs. Phase 1 adds assignment/event metadata under the admin plan. Phase 5 should first reuse `AdminNotification.recipientUserId` and dedupe storage for in-app citizen notices, through a new owner-scoped route and allowlisted public payload. If its admin-specific semantics block safe use, document that evidence before proposing a new notification table. Store citizen updates as request events (and allowlisted corrections), not a second request record. Record server time separately from any citizen-reported change time.

**Server/API:** Extend `app/api/rescue-requests/[id]/route.ts`, `lib/rescue-contracts.ts`, `lib/rescue-service.ts` and `lib/rescue-dto.ts` in their existing roles. Maintain owner query filters and expected-version CAS. Add owner-only action(s) for condition/details/location updates and “I am safe” when supported. A safe report by a citizen must create an admin follow-up event/notice; it must not silently close a dispatched request. Existing early cancellation may remain direct where safe; later cancellation remains a review request. An update after dispatch needs admin visibility before it changes operational location facts; preserve both old and reported new location in the private event. Validate Bulacan scope, required contact/description, string lengths, coordinate pairs and stale versions server-side. Limit frequency and duplicate submits with existing security conventions.

**Public projection:** Construct a dedicated allowlist for citizen response and notifications. An owner may see their own submitted contact and precise location as needed for correction, but never another person's case. Do not include organization contact list, contact-person name, private attempt notes, admin actor IDs, audit metadata, assignment IDs or internal-only events. Review legacy `confirmedTeamReference` and `outcome`: show only text explicitly safe for public display; otherwise return a public summary, while preserving raw data for admin/history. Public note visibility is an explicit admin decision, not a default for every operational event.

## Citizen status and timeline policy

| Stored state | Public label | Evidence/copy rule |
| --- | --- | --- |
| `received` | Request Received | Submission recorded; no assistance promised. |
| `under_review` | Under Review | Admin review started. |
| `awaiting_responder` | Coordinating Assistance | Selection/contact may be pending; no acceptance implied. |
| `responder_confirmed` | Assistance Confirmed | Only after admin records acceptance; label as simulated/admin-recorded. |
| `dispatched`, `en_route` | Response Underway | Distinguish dispatch from reported departure in timeline; no ETA or live position. |
| `on_scene` | Responders On Scene | Only after admin records arrival; say it is a recorded update. |
| `resolved` | Request Resolved | Show safe outcome summary and recorded time. |
| `closed` | Case Closed | Final case documentation recorded. |
| `cancelled` | Cancelled | Show who requested/confirmed it only when public and safe. |
| `duplicate` | Duplicate Request | Show safe next step/reference only if requester can access linked case. |
| `referred` | Referred | Do not imply destination accepted or dispatched. |
| `unable_to_contact` | Unable to Contact | Give safe next steps; omit private contact-attempt data. |
| Legacy `triaged`, `assigned`, `en_route`, `completed`, `rejected` | Existing safe labels with “legacy record” context where needed | Do not infer acceptance, dispatch or arrival that was never recorded. Raw status stays unchanged. |

`en_route` exists in both old and new flows; use assignment/event evidence or a workflow version marker, not the status string alone, to choose truthful copy. Display server-recorded timestamps for updates. If a separate reported occurrence time exists, label it as reported. Most recent confirmed public update comes from public events, not `updatedAt` (which may reflect an internal note). Stop polling only for policy-defined terminal cases; `resolved` may continue to `closed`.

## Phase-by-phase tasks and acceptance

### Phase 1 — Foundation review

- [ ] Re-run public intake/list/detail/correction/cancellation baseline tests against the additive migration.
- [ ] Confirm unchanged IDs, owner filters, Bulacan validation, idempotency and event ordering.
- [ ] Review DTO shape for newly added assignment/organization fields; do not expose them by broad object spreading.

**Acceptance:** Existing submission and tracking remain functional; no new private data enters public responses.

### Phase 2 — Coordination privacy

- [ ] Verify organization directory and contact attempts appear only in admin API/UI; public response contains no contact details or attempt notes.
- [ ] Ensure admin-recorded acceptance has a separate event from organization selection and simulated-contact disclosure.

**Acceptance:** Citizen sees no fabricated “dispatched” state merely because an organization was selected.

### Phase 3 — Lifecycle contract

- [ ] Add public labels and terminal/refresh rules in `lib/rescue-request-client.ts` for each new state and exception.
- [ ] Define public event types and safe notes with the admin service; test legacy status mapping without changing stored values.
- [ ] Ensure cancellation behavior and safe reports remain compatible with new transition guards.

**Acceptance:** Public labels match recorded evidence; old requests still render; `resolved` can progress to `closed`.

### Phase 4 — Cross-view consistency

- [ ] Verify the same request reference/status/version appears on citizen and admin views after actions and refresh.
- [ ] Check stale-state/error handling when admin updates a request while citizen page is open.

**Acceptance:** Admin UI refactor does not break citizen tracking or owner access.

### Phase 5 — Tracking, updates and notifications

**Pages/components:** Update `components/rescue-request-content.tsx`, `components/rescue-request-card.tsx`, `components/rescue-request-detail.tsx`, `lib/rescue-request-client.ts` and existing `/rescue-request` pages. Show reference, public state, submission time, latest confirmed public update and readable progress timeline. Keep responsive layout, loading/empty/retry/stale states, accessible labels/focus, keyboard support and Flood Watch styles. Use a concise simulation disclosure near status/submit actions, not repetitive banners.

- [ ] Use public projection for all citizen list/detail/timeline data; verify every public label and exceptional outcome.
- [ ] Let an owner submit new emergency details, changed condition/location, “I am safe” and cancellation request where valid. Preserve text on failed submission; show 409 refresh/retry. The admin queue receives important update/follow-up indicators.
- [ ] Add owner-scoped in-app notifications for public status changes, with dedupe, read state and a link only to owned cases. Reuse existing notification storage; no SMS/email/push promises.
- [ ] Generate admin notices for new request, important citizen update, overdue triage and unacknowledged assignment. Define an explicit review interval and test repeated scheduler/request runs do not duplicate alerts.
- [ ] Test cross-account denial, private field absence, cancelled/closed polling, network failure, duplicate submit and notification failure. Verify no private notes appear in browser/network payloads.

**Acceptance:** Citizens receive accurate public changes and can report meaningful changes; admins see and can review them; private operational details are inaccessible; notification failure does not corrupt request state.

### Phase 6 — End-to-end and demo

- [ ] Run the Plaridel scenario from citizen intake through two simulated organizations, unsuccessful contact, acceptance, dispatch, departure, arrival, resolution and close. Check owner timeline after reload at each stage.
- [ ] Verify public copy never claims a real emergency contact was called, a responder is currently available, a live position exists or an ETA is known.
- [ ] Test mobile intake/tracking, empty list, denied GPS/manual location, malformed location, stale version, another owner's ID, notification failure and return after reconnect.
- [ ] Run `npm run lint`, `npm run typecheck`, `npm test`, isolated `npm run test:integration`, relevant browser specs and build with required environment. Record actual results; skip blocked gates explicitly.

**Acceptance:** Full workflow persists and matches admin events; owner isolation and simulation disclosure hold; legacy cases still render.

## Security and compatibility risks

1. **Owner versus admin DTO:** Public event filters currently hide `visibility=internal` but expose selected shared fields. Explicit allowlists and tests are needed when assignment metadata is added.
2. **Legacy `en_route`:** Old records lack separate acknowledgement/dispatch/departure timestamps. Public timeline must not reconstruct missing steps or give misleading response-time claims.
3. **Sensitive corrections:** Changed location/condition may be urgent. Keep original request/event history and notify admins; a citizen report must not silently revise an active dispatch destination or close the case.
4. **Notification model:** `AdminNotification` has a recipient field but only admin routes today. A citizen endpoint must enforce owner identity, safe types, target ownership and bounded reads/writes. Failed alert delivery needs retry and dedupe.
5. **Real-world interpretation:** Even a simulated “Response Underway” label can be mistaken for a live dispatch. State clearly that admin-recorded demo updates are simulations and never supply an invented ETA, route or live team location.
6. **Migration and tests:** Phases 1–3 change shared DB/status contracts. Additive migrations, version-aware reads and staged UI/API rollout protect historical requests. Use disposable `TEST_DATABASE_URL`; never seed or test against live citizen data.
