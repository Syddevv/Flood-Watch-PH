import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL(
    "../prisma/migrations/20261017_registration_email_verification/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("the U3 migration preserves existing users in explicit review states", () => {
  assert.match(migration, /legacy_admin_review/);
  assert.match(migration, /legacy_grace/);
  assert.doesNotMatch(
    migration,
    /UPDATE\s+"User"[\s\S]*"emailVerificationStatus"\s*=\s*'verified'/i,
  );
  assert.doesNotMatch(migration, /DELETE\s+FROM\s+"User"/i);
});

test("the U3 migration stores only hashed verification codes", () => {
  assert.match(migration, /"codeHash"\s+TEXT\s+NOT NULL/);
  assert.match(migration, /"keyId"\s+TEXT\s+NOT NULL/);
  assert.doesNotMatch(migration, /"code"\s+TEXT/i);
});
