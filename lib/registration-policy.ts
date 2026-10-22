import { distanceToBulacanBoundaryMeters, isWithinBulacan } from "@/lib/bulacan-scope";
import { isValidEmail, isValidLatitude, isValidLongitude } from "@/lib/validations";

export const REGISTRATION_LOCATION_MAX_AGE_MS = 2 * 60 * 1000;
export const REGISTRATION_VERIFICATION_LIFETIME_MS = 10 * 60 * 1000;
export const REGISTRATION_MAX_ACCURACY_METERS = 100;

export function normalizeFullName(value: unknown) {
  if (typeof value !== "string") return null;
  const name = value.trim().replace(/\s+/gu, " ");
  if (name.length < 3 || name.length > 80) return null;
  const parts = name.split(" ");
  if (parts.length < 2 || parts.some((part) => !/^[\p{L}\p{M}]+(?:[.'’\-][\p{L}\p{M}]+)*\.?$/u.test(part))) return null;
  return name;
}

export function isValidRegistrationPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 10 && value.length <= 200 &&
    /\p{L}/u.test(value) && /[^\p{L}\s]/u.test(value);
}

export function registrationEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return isValidEmail(email) ? email : null;
}

export type LocationFix = { latitude: unknown; longitude: unknown; accuracy: unknown; capturedAt: unknown };

export function checkRegistrationLocation(fix: LocationFix, now = Date.now()): "valid" | "outside" | "unavailable" {
  const { latitude, longitude, accuracy, capturedAt } = fix;
  if (typeof latitude !== "number" || typeof longitude !== "number" ||
    !isValidLatitude(latitude) || !isValidLongitude(longitude) ||
    typeof accuracy !== "number" || !Number.isFinite(accuracy) || accuracy <= 0 ||
    typeof capturedAt !== "number" || !Number.isFinite(capturedAt) ||
    capturedAt > now + 10_000 || now - capturedAt > REGISTRATION_LOCATION_MAX_AGE_MS) return "unavailable";
  if (!isWithinBulacan(latitude, longitude)) return "outside";
  if (accuracy > REGISTRATION_MAX_ACCURACY_METERS ||
    distanceToBulacanBoundaryMeters(latitude, longitude) <= accuracy) return "unavailable";
  return "valid";
}
