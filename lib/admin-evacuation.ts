import { isValidLatitude, isValidLongitude } from "@/lib/validations";
export const CENTER_STATUSES = ["available", "standby", "temporarily_unavailable", "needs_verification"] as const;
export const CENTER_VERIFICATION_STATUSES = ["verified", "needs_verification", "outdated", "disputed"] as const;
export const CENTER_SOURCE_TYPES = ["official_dswd", "official_lgu", "openstreetmap", "community_reference", "sample_demo"] as const;
export function parseCenterPayload(body: unknown) {
  const value = body as Record<string, unknown> | null;
  const text = (key: string, max: number) => typeof value?.[key] === "string" ? String(value[key]).trim().replace(/\s+/g, " ").slice(0, max) : "";
  const latitude = Number(value?.latitude); const longitude = Number(value?.longitude);
  const status = text("status", 40); const verificationStatus = text("verificationStatus", 40); const sourceType = text("sourceType", 60);
  if (!text("name", 160) || !text("address", 240) || !text("city", 100) || !text("province", 100)) return { error: "Name, address, city, and province are required." };
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) return { error: "Valid latitude and longitude are required." };
  if (!(CENTER_STATUSES as readonly string[]).includes(status) || !(CENTER_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatus) || !(CENTER_SOURCE_TYPES as readonly string[]).includes(sourceType)) return { error: "Invalid evacuation-center status, verification status, or source type." };
  return { data: { name: text("name", 160), description: text("description", 500) || null, address: text("address", 240), barangay: text("barangay", 120) || null, city: text("city", 100), province: text("province", 100), region: text("region", 100) || null, latitude, longitude, contactNumber: text("contactNumber", 80) || null, facilities: Array.isArray(value?.facilities) ? value.facilities.filter((x): x is string => typeof x === "string").slice(0, 20) : [], status, verificationStatus, sourceType, sourceName: text("sourceName", 160) || null, sourceUrl: text("sourceUrl", 500) || null, notes: text("notes", 1000) || null, estimatedCapacity: Number.isInteger(value?.estimatedCapacity) ? Number(value?.estimatedCapacity) : null } };
}
