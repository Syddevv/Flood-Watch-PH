import assert from "node:assert/strict";
import test from "node:test";

import { hashPassword, isValidPasswordLength, verifyPassword } from "@/lib/password";

test("a hashed password verifies successfully against the original password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("correct horse battery staple", hash), true);
});

test("a hashed password rejects an incorrect password", async () => {
  const hash = await hashPassword("correct horse battery staple");
  assert.equal(await verifyPassword("wrong password entirely", hash), false);
});

test("hashing the same password twice produces different stored strings", async () => {
  const first = await hashPassword("correct horse battery staple");
  const second = await hashPassword("correct horse battery staple");
  assert.notEqual(first, second);
  assert.equal(await verifyPassword("correct horse battery staple", first), true);
  assert.equal(await verifyPassword("correct horse battery staple", second), true);
});

test("hashed passwords are stored in the self-describing scrypt:<salt>:<hash> format", async () => {
  const hash = await hashPassword("correct horse battery staple");
  const parts = hash.split(":");
  assert.equal(parts.length, 3);
  assert.equal(parts[0], "scrypt");
  assert.ok(/^[0-9a-f]+$/.test(parts[1]));
  assert.ok(/^[0-9a-f]+$/.test(parts[2]));
});

test("password length validation enforces the 10-200 character range", () => {
  assert.equal(isValidPasswordLength("a".repeat(9)), false);
  assert.equal(isValidPasswordLength("a".repeat(10)), true);
  assert.equal(isValidPasswordLength("a".repeat(200)), true);
  assert.equal(isValidPasswordLength("a".repeat(201)), false);
});
