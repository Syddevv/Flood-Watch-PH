> Rescue Request and Responder Dispatch sections are retired; other guidance in this document may still apply. See [retirement status](rescue-retirement.md).

# A6 rollout and handover

Prepared 2026-10-21. This is a controlled release checklist, not authorization to deploy or a claim that an emergency response desk is operating. Use the [U6 acceptance record](u6-acceptance-record.md) for the pending operator sign-offs.

## Current evidence

- A read-only `npx prisma migrate status` check on 2026-10-21 found all 26 migrations applied on the configured Supabase target, including `20261023_admin_review_feedback_action`. This local environment has `DATABASE_URL` but no `DIRECT_URL`, so Prisma migration and app runtime currently select the same URL. The target has not been identified as disposable or production here; confirm target identity again in each deployment environment. This check does not prove a backup, restore, or safe migration rehearsal.
- `npx tsx scripts/import-bulacan-emergency-directory.ts --dry-run` made no writes. It found 43 existing center source-key matches, 81 contact source-key matches, no center ambiguity or quarantine candidates, and five possible duplicate contact matches. Resolve those five contact matches with an operator before any `--apply` run. The source dataset still covers only 14 of 24 localities with named centers.
- Follow-up on 2026-10-21: Docker Desktop supplied a disposable PostgreSQL 16 container. All 26 migrations applied to it. Nine API integration tests and all 49 browser tests passed, including the real resident-to-admin completion flow and center API/map parity. `npm run check:deploy` passed lint, typecheck, 276 unit tests, and production build. Test-only Next build directories and port 3100 kept the existing development server on port 3000 untouched. GitHub Actions status remains unverified from this environment.
- A local `pg_dump` restored into a second disposable database. Counts matched for reports (3), incidents (8), rescues/events/centers/contacts/actions (0), and applied migrations (26); Prisma reported the restored schema up to date. These are disposable fixture counts, not operational data. A provider snapshot/restore, code rollback rehearsal, reviewed import/backfill, combined count/privacy fixture, manual accessibility review, and external sign-offs remain pending. No production backup, migration, import, or rollback was performed here.
- Repeated anonymous browser cases shared one test client address and exceeded the `report-session` limit of 10 per hour, producing session-initialization warnings. Authenticated report cases used unique test client addresses and passed. Review shared-network behavior separately; the browser run does not establish it.

## Release controls

All flags accept exactly `on` or `off`; unset means current behavior (`on`). A deployed build rejects other values. Changing a managed hosting environment variable may require a redeploy. Keep verified-account enforcement in place: the registration flag pauses new registrations and never grants unverified access.

| Flag | When `off` | Reads retained |
| --- | --- | --- |
| `REGISTRATION_INTAKE_ENABLED` | New account registration returns 503. | Sign-in and email-code verification. |
| `ONSITE_REPORT_INTAKE_ENABLED` | New public flood reports return 503. | Existing reports and authorized updates. |
| `PUBLIC_CENTER_FEED_ENABLED` | Public center list/detail return 503; map omits center markers. | Admin center management and other map data. |

The disabled response has `code: FEATURE_PAUSED`, HTTP 503, a request ID, and `Cache-Control: no-store`. Retired rescue flags are inert; see [retirement status](rescue-retirement.md).

## Migration and rollback sequence

1. Identify the target environment, app revision, `DATABASE_URL`, and `DIRECT_URL`. Record who confirmed both URLs address the same intended database. Collect a provider snapshot and prove a restore to an isolated database; record snapshot time and restore location outside this repository. Preserve rescue requests and audit history.
2. On the restored database, run `npx prisma migrate status`, then `npx prisma migrate deploy` only if reviewed migrations are pending. The rescue schema remains for historical compatibility. Verify no pending migrations, inspect counts/IDs for reports, incidents, centers, contacts, review actions, and retained rescue history, then run isolated integration and browser suites.
3. Review A2 dry-run matches and the five contact duplicate candidates. Run `--apply` only on an approved target after snapshot and source review; it preserves admin edits and uses one transaction. Repeat the dry run and compare before/after counts, source keys, archive states, and public DTOs. Never run `prisma db push` or the demo `db:seed` on production.
4. Deploy code built against the retained schema. Check health, admin authentication, one safe read for each active public API, protected access failures, notification visibility, retired-route 404 responses, and request ID logs. Enable remaining public intakes only after technical and operational gates below pass. Monitor errors, latency, rejected review actions, mail delivery, and stale resources.
5. If code must roll back, pause new writes and center feed, retain the additive schema and every historical record, and redeploy the previous compatible app revision. Restore a database backup only after a separate data-loss review; prefer a forward fix when new records exist. Never drop rescue/review tables or clear audit history as a routine rollback.

## Operator handover record

Fill each item with a named owner, effective time, evidence link, and backup contact before an operational release. No value is inferred from application data.

| Duty | Required record | Current state |
| --- | --- | --- |
| Resource provenance | Official center/contact sources, research dates, field verification, opening-status owner and cadence. | Pending; five contact duplicate candidates and ten center locality gaps. |
| Email | Verified sender, credential owner, successful inbox test, quota/bounce monitoring and escalation. | Pending. |
| Flood report review coverage | Desk hours, primary/backup reviewers, first-review target, out-of-hours procedure. | Pending. |
| Privacy | Retention period, legal hold/deletion process, access review, backup encryption and restore permissions. | Pending. |
| Outages | On-call owner for database, weather, geocoding, image upload, email and center-source failures; fallback phone instructions. | Pending. |
| Audit and handover | Daily review of new flood reports, unresolved incidents, failed notifications, conflicts, and next-shift acknowledgment. | Pending. |

## Release decision

**Technical readiness:** pending. Isolated migrations, API/browser gates, and a local dump/restore passed; provider backup restore, importer review, combined staging reconciliation, GitHub Actions evidence, and code rollback rehearsal remain. Passing lint/build alone is insufficient.

**Operational readiness:** pending until U6's geometry, resource, email, staffing, jurisdiction, and privacy sign-offs have named owners and dated evidence. Public emergency-service claims must wait for both gates.
