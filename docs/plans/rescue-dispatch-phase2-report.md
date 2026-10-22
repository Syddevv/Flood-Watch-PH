# Rescue dispatch Phase 2 review record

**Branch:** `feat/rescue-dispatch-phase2-coordination`  
**Date:** 22 October 2026  
**Scope:** Admin responder directory and manually recorded coordination. No automated calls, messages, responder accounts, dispatch status transitions or production migration.

## Behavior and compatibility

Admin-only directory routes list, create, read and update organizations. Search, coverage, capability and availability filters are bounded. Create defaults availability to `unknown`; admins can mark `available` only while confirming a recorded contact method. Contact changes without reconfirmation clear the verification timestamp. Inactive and unavailable organizations cannot be selected. Unknown, busy or stale availability requires an internal reason. The selection policy uses a seven-day contact verification window.

The rescue detail page now displays organization attempts. Selecting an organization, logging a manual contact attempt and recording an acceptance or failure are separate internal events. Request-version compare-and-swap prevents a repeated click from adding another attempt. A declined, unreachable or unavailable outcome ends that assignment and allows another selection; reassignment closes the previous active attempt and keeps its history. Phase 2 does not alter request status or claim dispatch. Existing legacy status actions remain for Phase 3 reconciliation.

The citizen DTO remains an explicit allowlist. The new admin detail response alone includes assignments and organization contacts. No new database schema or migration is required beyond Phase 1's additive tables. Rollback is an application rollback: stop using the directory and coordination routes; retain recorded assignments and internal events for later forward fixes.

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npm test`: 279/279 passed.
- `npm run build`: passed, including the new admin and API routes; local missing-environment warnings remain.
- Focused coordination and foundation integration tests: authored but skipped because `TEST_DATABASE_URL` is unset. Docker CLI exists, but the local engine is not running. No operational database was accessed.

## Before Phase 3

Run the focused integration tests against an isolated migrated PostgreSQL database and exercise the admin detail on mobile and desktop with fixture data. Then review Phase 2 and approve Phase 3's lifecycle/status changes. Phase 3 must reconcile the legacy direct `assigned → en_route` action without inventing acceptance or dispatch records.
