# A6 rollout and handover

Prepared 2026-10-21. This is a controlled release checklist, not authorization to deploy or a claim that an emergency response desk is operating. Use the [U6 acceptance record](u6-acceptance-record.md) for the pending operator sign-offs.

## Current evidence

- `npx prisma migrate status` against the configured migration target found 26 migrations and one pending migration: `20261023_admin_review_feedback_action`. This local environment has `DATABASE_URL` but no `DIRECT_URL`, so Prisma migration and app runtime currently select the same URL. The target has not been identified as disposable or production here; confirm target identity again in each deployment environment.
- `npx tsx scripts/import-bulacan-emergency-directory.ts --dry-run` made no writes. It found 43 existing center source-key matches, 81 contact source-key matches, no center ambiguity or quarantine candidates, and five possible duplicate contact matches. Resolve those five contact matches with an operator before any `--apply` run. The source dataset still covers only 14 of 24 localities with named centers.
- U6's live resident-to-admin browser flow, combined count reconciliation, manual accessibility review, and external sign-offs remain pending. No backup, production migration, import, or rollback rehearsal was performed during A6 preparation.
- Local A6 checks passed: lint, typecheck, 276 unit tests, Prisma schema validation, CI YAML parsing, production build, and a direct proxy check returning `503`/`FEATURE_PAUSED` with `no-store` and a request ID. The new center integration case was discovered but skipped locally because `TEST_DATABASE_URL` is absent. The existing local Next development server prevented a separate live pause-gate server check. GitHub Actions is configured to run API and selected database-backed browser cases on disposable PostgreSQL, but that CI run has not yet occurred.

## Release controls

All flags accept exactly `on` or `off`; unset means current behavior (`on`). A deployed build rejects other values. Changing a managed hosting environment variable may require a redeploy. Keep verified-account enforcement in place: the registration flag pauses new registrations and never grants unverified access.

| Flag | When `off` | Reads retained |
| --- | --- | --- |
| `REGISTRATION_INTAKE_ENABLED` | New account registration returns 503. | Sign-in and email-code verification. |
| `ONSITE_REPORT_INTAKE_ENABLED` | New public flood reports return 503. | Existing reports and authorized updates. |
| `PUBLIC_RESCUE_INTAKE_ENABLED` | New public rescue requests return 503. | Owner history, detail, and corrections; admin-assisted intake. |
| `ADMIN_RESCUE_ACTIONS_ENABLED` | Admin rescue action writes return 503. | Admin queue/detail and existing event history. Use manual operator handover for active cases. |
| `PUBLIC_CENTER_FEED_ENABLED` | Public center list/detail return 503; map omits center markers. | Admin center management and other map data. |

The disabled response has `code: FEATURE_PAUSED`, HTTP 503, a request ID, and `Cache-Control: no-store`. Turn off public rescue intake before a period without staffed triage. Never assume a toggle contacts a responder, acknowledges dispatch, or resolves cases already received.

## Migration and rollback sequence

1. Identify the target environment, app revision, `DATABASE_URL`, and `DIRECT_URL`. Record who confirmed both URLs address the same intended database. Collect a provider snapshot and prove a restore to an isolated database; record snapshot time and restore location outside this repository. Preserve rescue requests and audit history.
2. Keep new intake and dispatch controls paused if staffing or source sign-offs are incomplete. On the restored database, run `npx prisma migrate status`, then `npx prisma migrate deploy`. Migrations are additive through U0 scope, U3 email/onsite evidence, U4 resources, A0 rescue, A1 review, A2 locality, and the review-feedback constraint. There is no A5 index migration. Verify no pending migrations, inspect counts/IDs for reports, incidents, rescue requests/events, centers, contacts, and review actions, then run isolated integration and browser suites.
3. Review A2 dry-run matches and the five contact duplicate candidates. Run `--apply` only on an approved target after snapshot and source review; it preserves admin edits and uses one transaction. Repeat the dry run and compare before/after counts, source keys, archive states, and public DTOs. Never run `prisma db push` or the demo `db:seed` on production.
4. Deploy code built against the migrated schema. Check health, admin authentication, one safe read for each public API, protected access failures, notification visibility, and request ID logs. Enable public intake only after technical and operational gates below pass. Monitor errors, latency, rejected review actions, mail delivery, and stale resources.
5. If code must roll back, pause new writes and center feed, retain the additive schema and every already received case, and redeploy the previous compatible app revision. Assign an operator to reconcile open requests outside the app while actions are paused. Restore a database backup only after a separate data-loss review; prefer a forward fix when new records exist. Never drop rescue/review tables or clear audit history as a routine rollback.

## Operator handover record

Fill each item with a named owner, effective time, evidence link, and backup contact before an operational release. No value is inferred from application data.

| Duty | Required record | Current state |
| --- | --- | --- |
| Resource provenance | Official center/contact sources, research dates, field verification, opening-status owner and cadence. | Pending; five contact duplicate candidates and ten center locality gaps. |
| Email | Verified sender, credential owner, successful inbox test, quota/bounce monitoring and escalation. | Pending. |
| Triage coverage | Desk hours, primary/backup operators, first-review target, out-of-hours procedure. | Pending. |
| Dispatch | Authorized confirmer, team contact channel, acceptance reference, cancellation and escalation procedure. | Pending. Case-owner assignment alone is not dispatch. |
| Privacy | Retention period, legal hold/deletion process, access review, backup encryption and restore permissions. | Pending. |
| Outages | On-call owner for database, weather, geocoding, image upload, email and center-source failures; fallback phone instructions. | Pending. |
| Audit and handover | Daily review of new requests, unresolved incidents, failed notifications, conflicts, and next-shift acknowledgment. | Pending. |

## Release decision

**Technical readiness:** pending until isolated migrations, the full API/browser gates, backup restore, importer review, and rollback rehearsal pass. Passing lint/build alone is insufficient.

**Operational readiness:** pending until U6's geometry, resource, email, staffing, jurisdiction, and privacy sign-offs have named owners and dated evidence. Public emergency-service claims must wait for both gates.
