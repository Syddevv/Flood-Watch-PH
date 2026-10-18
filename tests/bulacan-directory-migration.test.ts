import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(new URL(
  "../prisma/migrations/20261018_bulacan_directory_verification_status/migration.sql",
  import.meta.url,
), "utf8");

test("directory status migration accepts sourced records and every legacy status", () => {
  assert.match(migration, /ADD CONSTRAINT "EvacuationCenter_verificationStatus_allowed_chk"/);
  for (const status of ["verified", "official_publication_found", "needs_verification", "outdated", "disputed"]) {
    assert.ok(migration.includes(`'${status}'`), `missing ${status}`);
  }
  assert.doesNotMatch(migration, /DELETE FROM|TRUNCATE|DROP TABLE/i);
});
