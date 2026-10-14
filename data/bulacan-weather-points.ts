import { isWithinBulacan, BULACAN_SCOPE_VERSION } from "@/lib/bulacan-scope";

/** Representative OSM Nominatim locality points, retrieved 14 October 2026.
 * Coordinates and PSGC codes match tests/fixtures/bulacan-locality-points.json.
 * These points sample different parts of Bulacan; each forecast describes its
 * named locality point, not conditions throughout a municipality or province.
 */
export const MONITORED_WEATHER_POINTS = [
  { code: "0301409000", name: "Hagonoy", latitude: 14.8355035, longitude: 120.7335206 },
  { code: "0301407000", name: "Calumpit", latitude: 14.9151703, longitude: 120.7662073 },
  { code: "0301410000", name: "City of Malolos", latitude: 14.843759, longitude: 120.8113694 },
  { code: "0301414000", name: "Obando", latitude: 14.70989, longitude: 120.9365149 },
  { code: "0301412000", name: "City of Meycauayan", latitude: 14.7345008, longitude: 120.9571635 },
  { code: "0301420000", name: "City of San Jose Del Monte", latitude: 14.8101978, longitude: 121.0474088 },
  { code: "0301401000", name: "Angat", latitude: 14.927794, longitude: 121.02914 },
  { code: "0301419000", name: "San Ildefonso", latitude: 15.0781219, longitude: 120.9398068 },
  { code: "0301421000", name: "San Miguel", latitude: 15.1405274, longitude: 120.9770621 },
  { code: "0301424000", name: "Doña Remedios Trinidad", latitude: 14.9706036, longitude: 121.0647854 },
] as const;

for (const point of MONITORED_WEATHER_POINTS) {
  if (!isWithinBulacan(point.latitude, point.longitude)) {
    throw new Error(`Weather point outside Bulacan: ${point.name}`);
  }
}

// Changing either the boundary or any point invalidates cached forecasts.
export const WEATHER_POINT_SET_VERSION = `${BULACAN_SCOPE_VERSION}:${MONITORED_WEATHER_POINTS.map(
  ({ code, latitude, longitude }) => `${code}@${latitude},${longitude}`,
).join("|")}`;
