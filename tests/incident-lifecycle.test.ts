import assert from "node:assert/strict";
import test from "node:test";

import { deriveIncidentAggregate } from "@/lib/incident-lifecycle";

const NOW = new Date("2026-08-23T12:00:00.000Z");

function createReport(overrides: Record<string, unknown> = {}) {
  return {
    status: "Needs More Confirmation",
    severity: "Moderate",
    confirmationCount: 0,
    resolvedCount: 0,
    createdAt: NOW,
    updatedAt: NOW,
    lastActivityAt: NOW,
    resolvedAt: null,
    archivedAt: null,
    ...overrides,
  };
}

test("a single active report yields an active incident", () => {
  const aggregate = deriveIncidentAggregate([createReport()], NOW);
  assert.equal(aggregate.status, "Needs More Confirmation");
});

test("one active report keeps the incident active even if another is resolved", () => {
  const active = createReport();
  const resolved = createReport({ resolvedCount: 3 });

  const aggregate = deriveIncidentAggregate([active, resolved], NOW);
  assert.equal(aggregate.status, "Needs More Confirmation");
});

test("all reports resolved yields a resolved incident", () => {
  const first = createReport({ resolvedCount: 3 });
  const second = createReport({ resolvedCount: 3 });

  const aggregate = deriveIncidentAggregate([first, second], NOW);
  assert.equal(aggregate.status, "Resolved");
});

test("incident status ranks confirmed above needs-more-confirmation", () => {
  const needsConfirmation = createReport();
  const confirmed = createReport({ confirmationCount: 2 });

  const aggregate = deriveIncidentAggregate([needsConfirmation, confirmed], NOW);
  assert.equal(aggregate.status, "Confirmed by Community");
});

test("with no active reports, the least-terminal status wins", () => {
  const likelyReceded = createReport({ resolvedCount: 2 });
  const resolved = createReport({ resolvedCount: 3 });

  const aggregate = deriveIncidentAggregate([likelyReceded, resolved], NOW);
  assert.equal(aggregate.status, "Likely Receded");
});

test("all reports archived yields an archived incident", () => {
  const first = createReport({ archivedAt: NOW });
  const second = createReport({ archivedAt: NOW });

  const aggregate = deriveIncidentAggregate([first, second], NOW);
  assert.equal(aggregate.status, "Archived");
});
