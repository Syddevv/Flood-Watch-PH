import { EVACUATION_CENTERS } from "@/data/evacuation-centers";
import { CALUMPIT_CENTER, isWithinCalumpitMapBounds } from "@/lib/calumpit-boundary";
import { calculateDistanceKm } from "@/lib/emergency-resources";
import { parseClampedPositiveNumber } from "@/lib/incident-config";
import type { EvacuationCenterResource } from "@/lib/types";

/**
 * Evacuation-center visibility scope.
 *
 * Principle: reports are restricted to Calumpit; evacuation centers are not.
 * Flood reports must fall inside the municipal polygon (`isWithinCalumpit`).
 * Evacuation centers instead use a configurable radius around the Calumpit
 * centre, clipped to the pannable map box so that anything the list shows can
 * also be reached on the map. Neighbouring-town centres therefore stay
 * visible; centres tens of kilometres away in Metro Manila / Rizal do not.
 *
 * Plain TypeScript with no server-only or Prisma imports: this runs in client
 * components (map, list page) and in the /api/map/all route alike.
 *
 * Distances use `calculateDistanceKm` (already used by the list page). A
 * second haversine, `calculateDistanceMeters` in lib/report-geo.ts, serves
 * the incident matcher; the duplication is known and left alone here.
 */

export const DEFAULT_EVACUATION_CENTER_NEARBY_RADIUS_KM = 25;
export const MAX_EVACUATION_CENTER_NEARBY_RADIUS_KM = 100;

export function resolveEvacuationCenterNearbyRadiusKm(raw: string | undefined) {
  return parseClampedPositiveNumber(
    raw,
    DEFAULT_EVACUATION_CENTER_NEARBY_RADIUS_KM,
    MAX_EVACUATION_CENTER_NEARBY_RADIUS_KM,
  );
}

// NEXT_PUBLIC_ so the same value is inlined for the browser bundle and the
// server; the nearby set is computed client-side from the static dataset.
export const EVACUATION_CENTER_NEARBY_RADIUS_KM = resolveEvacuationCenterNearbyRadiusKm(
  process.env.NEXT_PUBLIC_EVACUATION_CENTER_NEARBY_RADIUS_KM,
);

export const EVACUATION_CENTER_COVERAGE_LABEL = `within ${EVACUATION_CENTER_NEARBY_RADIUS_KM} km of Calumpit, Bulacan`;

type CenterPoint = Pick<EvacuationCenterResource, "latitude" | "longitude">;

const CALUMPIT_ORIGIN = { latitude: CALUMPIT_CENTER[0], longitude: CALUMPIT_CENTER[1] };

export function getEvacuationCenterDistanceKm(center: CenterPoint) {
  return calculateDistanceKm(CALUMPIT_ORIGIN, {
    latitude: center.latitude,
    longitude: center.longitude,
  });
}

export function isNearbyEvacuationCenter(
  center: CenterPoint,
  radiusKm: number = EVACUATION_CENTER_NEARBY_RADIUS_KM,
) {
  return (
    getEvacuationCenterDistanceKm(center) <= radiusKm &&
    isWithinCalumpitMapBounds(center.latitude, center.longitude)
  );
}

export function sortEvacuationCentersByDistanceFromCalumpit<T extends CenterPoint>(
  centers: readonly T[],
): T[] {
  return [...centers].sort(
    (left, right) => getEvacuationCenterDistanceKm(left) - getEvacuationCenterDistanceKm(right),
  );
}

export function selectNearbyEvacuationCenters<T extends CenterPoint>(
  centers: readonly T[],
  radiusKm: number = EVACUATION_CENTER_NEARBY_RADIUS_KM,
): T[] {
  return sortEvacuationCentersByDistanceFromCalumpit(
    centers.filter((center) => isNearbyEvacuationCenter(center, radiusKm)),
  );
}

export const NEARBY_EVACUATION_CENTERS: EvacuationCenterResource[] =
  selectNearbyEvacuationCenters(EVACUATION_CENTERS);

export const NEARBY_EVACUATION_CENTER_IDS: ReadonlySet<string> = new Set(
  NEARBY_EVACUATION_CENTERS.map((center) => center.id),
);

/** The four centres nearest to Calumpit; replaces the old hard-coded featured list. */
export const NEARBY_EVACUATION_FEATURED_CENTERS: EvacuationCenterResource[] =
  NEARBY_EVACUATION_CENTERS.slice(0, 4);
