import assert from "node:assert/strict";
import test from "node:test";

import { REPORT_TIME_ZONE, formatAbsoluteTime, formatRelativeTime } from "@/lib/reporting";

test("report timestamps render in Philippine time regardless of the host timezone", () => {
  assert.equal(REPORT_TIME_ZONE, "Asia/Manila");

  // 06:35 UTC is 14:35 PHT (UTC+8) on the same day.
  const formatted = formatAbsoluteTime("2026-08-26T06:35:00.000Z");

  assert.match(formatted, /2026/);
  assert.match(formatted, /Aug/);
  assert.match(formatted, /2:35/);
  assert.match(formatted, /pm/i);
});

test("a UTC instant that crosses midnight in Manila reports the local date", () => {
  // 2026-08-25T17:00Z is 2026-08-26 01:00 PHT - the next day locally.
  assert.match(formatAbsoluteTime("2026-08-25T17:00:00.000Z"), /Aug 26, 2026/);
});

test("absolute formatting degrades to an empty string on unusable input", () => {
  assert.equal(formatAbsoluteTime("not-a-date"), "");
  assert.equal(formatAbsoluteTime(new Date(Number.NaN)), "");
});

test("relative formatting still answers the freshness question", () => {
  const now = Date.now();

  assert.equal(formatRelativeTime(new Date(now - 30_000)), "Just now");
  assert.equal(formatRelativeTime(new Date(now - 5 * 60_000)), "5 mins ago");
  assert.equal(formatRelativeTime(new Date(now - 60 * 60_000)), "1 hr ago");
  assert.equal(formatRelativeTime(new Date(now - 48 * 60 * 60_000)), "2 days ago");
});
