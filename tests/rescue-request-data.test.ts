import assert from "node:assert/strict";
import test from "node:test";

import {
  RESCUE_ASSISTANCE_TAGS,
  RESCUE_HOTLINES,
  RESCUE_NO_ASSISTANCE_TAG_ID,
  RESCUE_TIMELINE_STAGES,
  RESCUE_WAIT_TIPS,
  SAMPLE_RESCUE_REQUESTS,
  buildPendingTimeline,
} from "@/lib/rescue-request-data";

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

test("sample requests reference Calumpit, never the reference mock's Marikina", () => {
  assert.ok(SAMPLE_RESCUE_REQUESTS.length > 0);

  for (const request of SAMPLE_RESCUE_REQUESTS) {
    const haystack = `${request.locationName} ${request.assignedTeam ?? ""} ${request.description}`;
    assert.ok(
      /calumpit/i.test(request.locationName),
      `${request.id} is not located in Calumpit`,
    );
    assert.ok(!/marikina/i.test(haystack), `${request.id} still mentions Marikina`);
  }
});

test("sample request timelines cover every stage in order", () => {
  for (const request of SAMPLE_RESCUE_REQUESTS) {
    assert.deepEqual(
      request.timeline.map((entry) => entry.stage),
      [...RESCUE_TIMELINE_STAGES],
      `${request.id} has an unexpected timeline`,
    );
  }
});

test("sample request timelines never resume after a pending stage", () => {
  for (const request of SAMPLE_RESCUE_REQUESTS) {
    const firstPendingIndex = request.timeline.findIndex((entry) => entry.time === null);

    if (firstPendingIndex === -1) {
      continue;
    }

    const tail = request.timeline.slice(firstPendingIndex);
    assert.ok(
      tail.every((entry) => entry.time === null),
      `${request.id} has a completed stage after a pending one`,
    );
  }
});

test("sample assistance tag ids all resolve to a defined tag", () => {
  const known = new Set(RESCUE_ASSISTANCE_TAGS.map((tag) => tag.id));

  for (const request of SAMPLE_RESCUE_REQUESTS) {
    for (const tagId of request.assistanceTagIds) {
      assert.ok(known.has(tagId), `${request.id} references unknown tag ${tagId}`);
    }
  }
});

test("a freshly submitted request only has its first stage filled in", () => {
  const timeline = buildPendingTimeline("4:10 PM");

  assert.deepEqual(
    timeline.map((entry) => entry.stage),
    [...RESCUE_TIMELINE_STAGES],
  );
  assert.equal(timeline[0].time, "4:10 PM");
  assert.ok(timeline.slice(1).every((entry) => entry.time === null));
  assert.ok(timeline.slice(1).every((entry) => entry.detail === null));
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
