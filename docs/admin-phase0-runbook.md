# Admin Phase 0 Database Runbook

## Apply a migration

1. Confirm the target environment and take a database backup.
2. Run `npx prisma migrate status` with that environment's `DATABASE_URL`.
3. Run `npx prisma migrate deploy`.
4. Run `npx prisma migrate status` again and confirm no pending migrations remain.
5. Run `npx prisma generate` and deploy the application built against the same schema.

Do not use `npx prisma migrate dev` against staging or production.

## Seed verification

Run `npm run db:seed` only against a disposable development or staging database. The seed replaces named demo reports and centers, and refreshes Phase 0 settings, notifications, and seeded report action history. Never run it against production data unless the replacement behavior has been explicitly approved.

## Rollback rehearsal

Prisma migrations are forward-only in the normal deployment workflow. For a staging rehearsal:

1. Restore a recent staging backup to a temporary database.
2. Apply all migrations through `20260906_admin_phase0_foundation`.
3. Verify the new tables, indexes, constraints, and `EvacuationCenter.updatedByUserId`.
4. Restore the pre-migration backup or execute a reviewed down script in the temporary database.
5. Re-run the application smoke checks against the restored schema.

Never improvise a production down migration. Prefer backup restore and a tested forward fix.

## Smoke checks

- `GET /api/admin/session` returns the admin DTO with `data`, `error`, and `requestId`.
- Unauthenticated admin API calls return `401` with the same response envelope.
- `AdminOperationalAction`, `AdminNotification`, and `AdminSetting` are queryable through Prisma.
- Re-running the seed does not duplicate Phase 0 notifications or seeded action history.
- Report and center public APIs continue to return their existing response shapes.

## Observability

Track request ID, endpoint, status code, and duration for admin APIs. Do not log passwords, tokens, database URLs, service keys, report descriptions, photos, or unnecessary personal data.
