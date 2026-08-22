export function buildCoordinateFallbackLabel(
  latitude: number,
  longitude: number,
  prefix = "Location near",
): string {
  return `${prefix} ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}
