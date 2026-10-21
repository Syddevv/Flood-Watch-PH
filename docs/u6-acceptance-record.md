# U6 acceptance and operator sign-off record

Prepared 2026-10-21 on `feat/u6-user-admin-acceptance`. This record is a release gate, not approval to provide emergency dispatch. No operator has signed it.

## Technical acceptance

| Check | Evidence | State |
| --- | --- | --- |
| All 24 Bulacan locality identifiers and polygon edge/hole behavior | `tests/bulacan-scope.test.ts` covers all locality fixture points and synthetic edge/hole cases. The polygon remains indicative. | Automated unit proof available; official geometry pending |
| Resident request through admin completion and back to owner | `tests/browser/user-admin-rescue-acceptance.spec.ts` exercises real APIs, sessions, queue, triage, notes, assignment, confirmed dispatch, completion, owner timeline, and another user's denied read. | Written; requires isolated PostgreSQL browser run |
| Public center list and map parity | `tests/browser/evacuation-center-scope.spec.ts` compares both APIs and the rendered list without fixed demo counts. | Written; requires isolated PostgreSQL browser run |
| Other cross-phase cases | Existing unit, integration, and browser suites cover parts of weather failures, onsite evidence, email verification, report review, rescue concurrency, and analytics. | Full U6 matrix and staging run pending |
| Public copy and accessibility on phone/desktop | Existing focused browser cases cover several phone layouts, focus behavior, and failure copy. | Manual and cross-flow review pending |
| Public/admin report, incident, rescue, and analytics reconciliation | Existing integration suites cover separate services. | Combined staging fixture and reconciliation pending |

Local technical checks on 2026-10-21: `npm run lint`, `npm run typecheck`, `npm run test` (273 passed), and `npm run build` passed. Fifteen API-stubbed rescue/resource browser tests and one flood-map browser test passed using an invalid local database URL; two database center cases were skipped. `npx playwright test --list` discovered the new resident-to-admin case. No isolated `TEST_DATABASE_URL` is configured locally, so the real database browser flow and integration suite were not run. Docker Desktop is not running, and no local PostgreSQL binary was found. The local build warned that deployment-only secrets and email settings are absent; it was not a deployment configuration check.

Run the database browser cases only with a disposable PostgreSQL database. Set `TEST_DATABASE_URL` and matching `DATABASE_URL`/`DIRECT_URL`, apply migrations there, then run `npx playwright test tests/browser/user-admin-rescue-acceptance.spec.ts tests/browser/evacuation-center-scope.spec.ts`. Never use production for these tests.

## Required operator sign-offs

| Gate | Evidence required | Status / signer |
| --- | --- | --- |
| Authoritative Bulacan geometry | Licensed, dated authoritative polygon; approved edge/coast/island policy and version. | Pending; no signer. Current OSM boundary is indicative. |
| Evacuation centers | Official LGU/PDRRMO/MDRRMO/CDRRMO evidence, duplicate review, location checks, and current opening-status process for every locality. | Pending; no signer. Starter directory covers 14 of 24 localities, and A2 import has not been approved for production. |
| Emergency contacts | Official, dated contact records and a verification cadence for every locality; phone checks before publication. | Pending; no signer. |
| Email verification | Production sender configuration, real inbox delivery, bounce/complaint monitoring, and legacy account review. | Pending; no signer. |
| Responder coverage | Named staffed rescue desk, duty hours, dispatch acknowledgment procedure, escalation contacts, and jurisdictional agreements. | Pending; no signer. No automated action proves a team is staffed or dispatched. |

**Release decision: pending.** Carry these gates and the incomplete technical checks into A6. A passing build or automated test cannot substitute for the operator evidence above.
