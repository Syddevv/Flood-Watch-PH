import boundary from "@/data/bulacan-boundary.json";

export type LatLngTuple = [number, number];
type Position = [number, number];
type Ring = Position[];
type PolygonCoordinates = Ring[];
type Geometry = { type: "Polygon"; coordinates: PolygonCoordinates } | { type: "MultiPolygon"; coordinates: PolygonCoordinates[] };

export const BULACAN_SCOPE_VERSION = "osm-1504656-2026-10-14";
export const OUTSIDE_BULACAN_ERROR_MESSAGE = "This location is outside Bulacan. Flood Watch currently accepts reports within Bulacan only.";
export const BULACAN_BOUNDARY_PATH_OPTIONS = { color: "#1d4ed8", weight: 3, opacity: 1, dashArray: "10 6", fillColor: "#2563eb", fillOpacity: 0.06 } as const;
export const BULACAN_MASK_PATH_OPTIONS = { stroke: false, fillColor: "#0f172a", fillOpacity: 0.28, fillRule: "evenodd" } as const;

export function parseScopeGeometry(input: unknown): PolygonCoordinates[] {
  const candidate = input && typeof input === "object" && "geometry" in input ? (input as { geometry: unknown }).geometry : input;
  if (!candidate || typeof candidate !== "object" || !("type" in candidate) || !("coordinates" in candidate)) throw new Error("Invalid Bulacan boundary geometry");
  const geometry = candidate as Geometry;
  const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : null;
  if (!polygons || !Array.isArray(polygons) || polygons.length === 0) throw new Error("Invalid Bulacan boundary geometry");
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) throw new Error("Invalid Bulacan boundary polygon");
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4 || ring.some((p) => !Array.isArray(p) || p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1]) || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) throw new Error("Invalid Bulacan boundary ring");
      if (ring[0][0] !== ring[ring.length - 1][0] || ring[0][1] !== ring[ring.length - 1][1]) throw new Error("Unclosed Bulacan boundary ring");
    }
  }
  return polygons;
}

const polygons = parseScopeGeometry(boundary);
const allPositions = polygons.flat(2);
const longitudes = allPositions.map(([longitude]) => longitude);
const latitudes = allPositions.map(([, latitude]) => latitude);
export const BULACAN_BOUNDS: [LatLngTuple, LatLngTuple] = [[Math.min(...latitudes), Math.min(...longitudes)], [Math.max(...latitudes), Math.max(...longitudes)]];
export const BULACAN_CENTER: LatLngTuple = [14.94, 121.05];
export const BULACAN_MAP_MAX_BOUNDS: [LatLngTuple, LatLngTuple] = [[14.45, 120.5], [15.43, 121.52]];
export const BULACAN_POLYGONS: LatLngTuple[][][] = polygons.map((polygon) => polygon.map((ring) => ring.map(([longitude, latitude]) => [latitude, longitude])));
export const BULACAN_OUTSIDE_MASK: LatLngTuple[][] = [
  [[13.5, 119], [13.5, 122.5], [16.5, 122.5], [16.5, 119]],
  ...polygons.map((polygon) => polygon[0].map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple)),
];
export const BULACAN_HOLE_MASKS: LatLngTuple[][] = polygons.flatMap((polygon) =>
  polygon.slice(1).map((ring) => ring.map(([longitude, latitude]) => [latitude, longitude] as LatLngTuple)),
);

function onSegment(latitude: number, longitude: number, [x1, y1]: Position, [x2, y2]: Position) {
  const cross = (longitude - x1) * (y2 - y1) - (latitude - y1) * (x2 - x1);
  return Math.abs(cross) <= 1e-10 && longitude >= Math.min(x1, x2) - 1e-10 && longitude <= Math.max(x1, x2) + 1e-10 && latitude >= Math.min(y1, y2) - 1e-10 && latitude <= Math.max(y1, y2) + 1e-10;
}

function ringPosition(latitude: number, longitude: number, ring: Ring): "inside" | "edge" | "outside" {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i++) {
    const a = ring[j], b = ring[i];
    if (onSegment(latitude, longitude, a, b)) return "edge";
    if ((a[1] > latitude) !== (b[1] > latitude) && longitude < ((b[0] - a[0]) * (latitude - a[1])) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside ? "inside" : "outside";
}

/** Exterior edges are included; hole edges and interiors are excluded. */
function pointInPolygons(latitude: number, longitude: number, parsedPolygons: PolygonCoordinates[]): boolean {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return false;
  for (const [outer, ...holes] of parsedPolygons) {
    if (ringPosition(latitude, longitude, outer) === "outside") continue;
    if (holes.some((hole) => ringPosition(latitude, longitude, hole) !== "outside")) continue;
    return true;
  }
  return false;
}

export function isPointInScopeGeometry(latitude: number, longitude: number, geometry: unknown): boolean {
  return pointInPolygons(latitude, longitude, parseScopeGeometry(geometry));
}

export function isWithinBulacanMapBounds(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && latitude >= BULACAN_MAP_MAX_BOUNDS[0][0] && latitude <= BULACAN_MAP_MAX_BOUNDS[1][0] && longitude >= BULACAN_MAP_MAX_BOUNDS[0][1] && longitude <= BULACAN_MAP_MAX_BOUNDS[1][1];
}

export function isWithinBulacan(latitude: number, longitude: number) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < BULACAN_BOUNDS[0][0] || latitude > BULACAN_BOUNDS[1][0] || longitude < BULACAN_BOUNDS[0][1] || longitude > BULACAN_BOUNDS[1][1]) return false;
  return pointInPolygons(latitude, longitude, polygons);
}
