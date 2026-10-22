> Rescue Request and Responder Dispatch sections are retired; other guidance in this document may still apply. See [retirement status](rescue-retirement.md).

# U6 acceptance and operator sign-off record

Prepared 2026-10-21 on `feat/u6-user-admin-acceptance`. This record is a release gate, not approval to provide emergency dispatch. No operator has signed it.

## Technical acceptance

| Check | Evidence | State |
| --- | --- | --- |
| All 24 Bulacan locality identifiers and polygon edge/hole behavior | `tests/bulacan-scope.test.ts` covers all locality fixture points and synthetic edge/hole cases. The polygon remains indicative. | Automated unit proof passed; official geometry pending |
| Resident request through admin completion and back to owner | `tests/browser/user-admin-rescue-acceptance.spec.ts` exercises real APIs, sessions, queue, triage, notes, assignment, confirmed dispatch, completion, owner timeline, and another user's denied read. | Passed on isolated PostgreSQL, 2026-10-21 |
| Public center list and map parity | `tests/browser/evacuation-center-scope.spec.ts` compares both APIs and the rendered list without fixed demo counts. | Passed on isolated PostgreSQL, 2026-10-21 |
| Other cross-phase cases | Unit, integration, and browser suites cover weather failures, onsite evidence, email verification, report review, rescue concurrency, and analytics. | 276 unit, 9 integration, and 49 browser cases passed; external data validation pending |
| Public copy and accessibility on phone/desktop | Automated browser cases cover phone layouts, focus behavior, and failure copy. | Manual device, keyboard, screen-reader, and copy review pending |
| Public/admin report, incident, rescue, and analytics reconciliation | Analytics integration reconciles database totals and CSV; review and rescue tests cover separate privacy/timeline paths. | Combined staging fixture and legacy visibility review pending |

Follow-up technical checks on 2026-10-21: Docker Desktop supplied a disposable PostgreSQL 16 container. All 26 committed migrations applied there. `npm run test:integration` passed 9/9, `npx playwright test --workers=1 --retries=0` passed 49/49 using test-only email and image-upload stubs, and `npm run check:deploy` passed lint, typecheck, 276 unit tests, and the production build. The browser run used a separate Next build directory and localhost port, leaving the existing development server untouched. A local `pg_dump` restored into a second disposable database; report, incident, rescue, event, center, contact, action, and migration counts matched the source, and `npx prisma migrate status` reported all 26 migrations applied on the restore. This is a local rehearsal, not a provider backup restore or production deployment check.

Anonymous browser cases reused one test client address and accumulated `report-session` rate-limit entries (108 on the leading key versus the route's limit of 10 per hour), producing expected session-initialization warnings after repeated runs. Authenticated report cases used unique test client addresses and passed. The warnings do not demonstrate production email delivery or shared-network behavior.

Run the database browser cases only with disposable PostgreSQL. Set `TEST_DATABASE_URL` and matching `DATABASE_URL`/`DIRECT_URL`, configure test-only email/image stubs and a local `PLAYWRIGHT_BASE_URL`, apply migrations there, then run `npm run test:integration` and `npx playwright test --workers=1`. Never use production for these tests.

## Required operator sign-offs

| Gate | Evidence required | Status / signer |
| --- | --- | --- |
| Authoritative Bulacan geometry | Licensed, dated authoritative polygon; approved edge/coast/island policy and version. | Pending; no signer. Current OSM boundary is indicative. |
| Evacuation centers | Official LGU/PDRRMO/MDRRMO/CDRRMO evidence, duplicate review, location checks, and current opening-status process for every locality. | Pending; no signer. Starter directory covers 14 of 24 localities, and A2 import has not been approved for production. |
| Emergency contacts | Official, dated contact records and a verification cadence for every locality; phone checks before publication. | Pending; no signer. |
| Email verification | Production sender configuration, real inbox delivery, bounce/complaint monitoring, and legacy account review. | Pending; no signer. |
| Responder coverage | Named staffed rescue desk, duty hours, dispatch acknowledgment procedure, escalation contacts, and jurisdictional agreements. | Pending; no signer. No automated action proves a team is staffed or dispatched. |

**Release decision: pending.** Carry these gates and the incomplete technical checks into A6. A passing build or automated test cannot substitute for the operator evidence above.
