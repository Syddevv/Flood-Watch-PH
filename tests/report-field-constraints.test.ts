import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("report field constraint migration protects all supported report vocabularies", async () => {
  const migration = await readFile(
    "prisma/migrations/20260821_report_field_constraints/migration.sql",
    "utf8",
  );

  for (const value of ["Low", "Moderate", "High", "Critical"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  for (const value of ["Community", "Official", "System"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  for (const value of ["still_active", "confirmed", "resolved"]) {
    assert.match(migration, new RegExp(`'${value}'`));
  }
  assert.match(migration, /FloodReport_status_allowed_chk/);
  assert.match(migration, /NOT VALID/g);
});
