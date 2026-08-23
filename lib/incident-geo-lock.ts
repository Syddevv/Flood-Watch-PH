const INCIDENT_GEO_LOCK_CELL_DEGREES = 0.01;

export type IncidentGeoLockCell = {
  cellX: number;
  cellY: number;
};

/**
 * The 3x3 grid-cell neighborhood around a point, sorted into a fixed global
 * order so every transaction acquires overlapping advisory locks in the same
 * sequence (prevents lock-ordering deadlocks). Cell size (~1.1km) is
 * deliberately coarser than the incident match radius cap, so any two points
 * close enough to match always share at least one cell.
 */
export function getIncidentGeoLockCellNeighborhood(
  latitude: number,
  longitude: number,
): IncidentGeoLockCell[] {
  const cellX = Math.floor(longitude / INCIDENT_GEO_LOCK_CELL_DEGREES);
  const cellY = Math.floor(latitude / INCIDENT_GEO_LOCK_CELL_DEGREES);

  const cells: IncidentGeoLockCell[] = [];
  for (let dx = -1; dx <= 1; dx += 1) {
    for (let dy = -1; dy <= 1; dy += 1) {
      cells.push({ cellX: cellX + dx, cellY: cellY + dy });
    }
  }

  return cells.sort((left, right) =>
    left.cellX !== right.cellX ? left.cellX - right.cellX : left.cellY - right.cellY,
  );
}
