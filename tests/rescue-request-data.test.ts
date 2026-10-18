import assert from "node:assert/strict";
import test from "node:test";

import {
  RESCUE_ASSISTANCE_TAGS,
  RESCUE_HOTLINES,
  RESCUE_NO_ASSISTANCE_TAG_ID,
  RESCUE_WAIT_TIPS,
} from "@/lib/rescue-request-data";
import { isTerminalRescue, rescueEventLabel, rescueStatusLabel, shouldPollRescue } from "@/lib/rescue-request-client";

test("assistance tags are unique and include the opt-out tag", () => {
  const ids = RESCUE_ASSISTANCE_TAGS.map((tag) => tag.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.includes(RESCUE_NO_ASSISTANCE_TAG_ID));
  assert.equal(RESCUE_ASSISTANCE_TAGS.length, 6);
});

test("every assistance tag carries display copy", () => {
  for (const tag of RESCUE_ASSISTANCE_TAGS) {
    assert.ok(tag.label.trim().length > 0, `${tag.id} has no label`);
    assert.ok(tag.description.trim().length > 0, `${tag.id} has no description`);
  }
});

test("statuses only claim dispatch after an en-route event", () => {
  assert.equal(rescueStatusLabel("received"), "Request received");
  assert.equal(rescueStatusLabel("assigned"), "Coordinator assigned");
  assert.equal(rescueStatusLabel("en_route"), "Team en route");
});

test("corrections and cancellation requests are not mislabeled as status changes", () => {
  const event = { id: "event", nextStatus: "assigned", createdAt: "2026-10-18T03:00:00.000Z", note: null };
  assert.equal(rescueEventLabel({ ...event, eventType: "requester_correction" }), "Details updated");
  assert.equal(rescueEventLabel({ ...event, eventType: "cancellation_requested" }), "Cancellation requested");
  assert.equal(rescueEventLabel({ ...event, eventType: "assign" }), "Coordinator assigned");
});

test("polling stops once every request is terminal", () => {
  assert.equal(isTerminalRescue("completed"), true);
  assert.equal(shouldPollRescue([{ status: "completed" }, { status: "cancelled" }]), false);
  assert.equal(shouldPollRescue([{ status: "completed" }, { status: "triaged" }]), true);
});

test("hotline rows expose a dialable href", () => {
  assert.ok(RESCUE_HOTLINES.length >= 3);

  for (const hotline of RESCUE_HOTLINES) {
    assert.ok(hotline.href.startsWith("tel:"), `${hotline.id} is not dialable`);
    assert.ok(hotline.label.trim().length > 0);
    assert.ok(hotline.number.trim().length > 0);
  }
});

test("wait tips are non-empty guidance strings", () => {
  assert.equal(RESCUE_WAIT_TIPS.length, 4);
  assert.ok(RESCUE_WAIT_TIPS.every((tip) => tip.trim().length > 0));
});
