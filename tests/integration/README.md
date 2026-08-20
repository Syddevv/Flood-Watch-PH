# Integration tests

These tests run against a dedicated PostgreSQL database and never fall back to
`DATABASE_URL`. Set `TEST_DATABASE_URL` explicitly, apply the committed Prisma
migrations to that database, then run:

```powershell
$env:TEST_DATABASE_URL = "postgresql://..."
$env:DIRECT_URL = $env:TEST_DATABASE_URL
npx prisma migrate deploy
npm run test:integration
```

Without `TEST_DATABASE_URL`, the integration suite is skipped by design. This
prevents a local test run from mutating the production Supabase database.
