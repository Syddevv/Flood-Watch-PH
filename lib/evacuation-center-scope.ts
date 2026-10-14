import { EVACUATION_CENTERS } from "@/data/evacuation-centers";
import { BULACAN_CENTER, isWithinBulacan } from "@/lib/bulacan-scope";
import { calculateDistanceKm } from "@/lib/emergency-resources";
import { parseClampedPositiveNumber } from "@/lib/incident-config";
import type { EvacuationCenterResource } from "@/lib/types";

/**
 * Temporary static-reference scope until A2/U4 provide canonical center data.
 * Public references must be within the same Bulacan polygon as reports.
 * Distance is used for ordering; an explicit radius may narrow a nearby search.
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

// Retained for callers that request an explicit nearby-search radius.
export const EVACUATION_CENTER_NEARBY_RADIUS_KM = resolveEvacuationCenterNearbyRadiusKm(
  process.env.NEXT_PUBLIC_EVACUATION_CENTER_NEARBY_RADIUS_KM,
);

export const EVACUATION_CENTER_COVERAGE_LABEL = "within Bulacan (reference locations; verification pending)";

type CenterPoint = Pick<EvacuationCenterResource, "latitude" | "longitude">;

const BULACAN_ORIGIN = { latitude: BULACAN_CENTER[0], longitude: BULACAN_CENTER[1] };

export function getEvacuationCenterDistanceKm(center: CenterPoint) {
  return calculateDistanceKm(BULACAN_ORIGIN, {
    latitude: center.latitude,
    longitude: center.longitude,
  });
}

export function isNearbyEvacuationCenter(
  center: CenterPoint,
  radiusKm: number = Number.POSITIVE_INFINITY,
) {
  return (
    getEvacuationCenterDistanceKm(center) <= radiusKm &&
    isWithinBulacan(center.latitude, center.longitude)
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
  radiusKm: number = Number.POSITIVE_INFINITY,
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

/** The four in-province references nearest to the map center. */
export const NEARBY_EVACUATION_FEATURED_CENTERS: EvacuationCenterResource[] =
  NEARBY_EVACUATION_CENTERS.slice(0, 4);
