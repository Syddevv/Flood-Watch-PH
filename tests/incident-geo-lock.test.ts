import assert from "node:assert/strict";
import test from "node:test";

import { getIncidentGeoLockCellNeighborhood } from "@/lib/incident-geo-lock";

test("returns the 9-cell neighborhood around the containing cell", () => {
  const cells = getIncidentGeoLockCellNeighborhood(14.9333, 120.7667);

  assert.equal(cells.length, 9);
  const uniqueCells = new Set(cells.map((cell) => `${cell.cellX}:${cell.cellY}`));
  assert.equal(uniqueCells.size, 9);
});

test("neighborhood is sorted ascending by (cellX, cellY)", () => {
  const cells = getIncidentGeoLockCellNeighborhood(14.9333, 120.7667);

  for (let i = 1; i < cells.length; i += 1) {
    const previous = cells[i - 1];
    const current = cells[i];
    const isOrdered =
      previous.cellX < current.cellX ||
      (previous.cellX === current.cellX && previous.cellY <= current.cellY);
    assert.ok(isOrdered, `cells out of order at index ${i}`);
  }
});

test("two points a few meters apart share a common cell in their neighborhoods", () => {
  const a = getIncidentGeoLockCellNeighborhood(14.9333, 120.7667);
  const b = getIncidentGeoLockCellNeighborhood(14.93335, 120.76675);

  const aKeys = new Set(a.map((cell) => `${cell.cellX}:${cell.cellY}`));
  const sharesCell = b.some((cell) => aKeys.has(`${cell.cellX}:${cell.cellY}`));

  assert.ok(sharesCell);
});

test("the same point always produces the same neighborhood (fixed lock order)", () => {
  const first = getIncidentGeoLockCellNeighborhood(14.9333, 120.7667);
  const second = getIncidentGeoLockCellNeighborhood(14.9333, 120.7667);

  assert.deepEqual(first, second);
});
