import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { BULACAN_SCOPE_VERSION, isWithinBulacan } from "@/lib/bulacan-scope";
import { isSafeCenterSourceUrl } from "@/lib/public-evacuation-centers";
import { isValidLatitude, isValidLongitude } from "@/lib/validations";

export const CENTER_STATUSES = ["available", "standby", "temporarily_unavailable", "needs_verification"] as const;
export const CENTER_VERIFICATION_STATUSES = ["verified", "needs_verification", "outdated", "disputed"] as const;
export const CENTER_SOURCE_TYPES = ["official_dswd", "official_lgu", "openstreetmap", "community_reference"] as const;
export const CENTER_FACILITIES = ["pwd_accessible", "medical_support", "drinking_water", "restrooms", "pet_friendly", "parking"] as const;

export function parseCenterPayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid evacuation-center data." };
  const value = body as Record<string, unknown>;
  const text = (key: string, max: number) => typeof value[key] === "string"
    ? value[key].trim().replace(/\s+/g, " ").slice(0, max)
    : "";
  const name = text("name", 160);
  const address = text("address", 240);
  const cityInput = text("city", 100);
  const city = BULACAN_LOCALITIES.find((locality) => locality.name.toLowerCase() === cityInput.toLowerCase())?.name;
  const province = text("province", 100);
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  const status = text("status", 40);
  const verificationStatus = text("verificationStatus", 40);
  const sourceType = text("sourceType", 60);
  const sourceUrl = text("sourceUrl", 500);
  const verifiedDate = text("lastVerifiedAt", 40);
  const lastVerifiedAt = verifiedDate && !Number.isNaN(Date.parse(verifiedDate)) ? new Date(verifiedDate) : null;
  const capacity = value.estimatedCapacity == null || value.estimatedCapacity === ""
    ? null : Number(value.estimatedCapacity);
  const facilities = value.facilities;

  if (!name || !address) return { error: "Name and address are required." };
  if (!city || province.toLowerCase() !== "bulacan") return { error: "Select a Bulacan municipality or city." };
  if (!isValidLatitude(latitude) || !isValidLongitude(longitude) || !isWithinBulacan(latitude, longitude)) {
    return { error: "Center coordinates must be inside Bulacan." };
  }
  if (!(CENTER_STATUSES as readonly string[]).includes(status) ||
      !(CENTER_VERIFICATION_STATUSES as readonly string[]).includes(verificationStatus) ||
      !(CENTER_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return { error: "Invalid center status, verification, or source type." };
  }
  if (!Array.isArray(facilities) || facilities.length > CENTER_FACILITIES.length ||
      facilities.some((facility) => typeof facility !== "string" || !(CENTER_FACILITIES as readonly string[]).includes(facility))) {
    return { error: "Invalid facilities." };
  }
  if (capacity !== null && (!Number.isSafeInteger(capacity) || capacity < 0)) return { error: "Estimated capacity must be a non-negative whole number." };
  if (sourceUrl && !isSafeCenterSourceUrl(sourceUrl)) return { error: "Source URL must be a valid HTTPS address." };
  if (verifiedDate && !lastVerifiedAt) return { error: "Last checked date is invalid." };
  if (verificationStatus === "verified" &&
      (!sourceUrl || !["official_dswd", "official_lgu"].includes(sourceType) || !lastVerifiedAt || lastVerifiedAt > new Date())) {
    return { error: "Verified centers require an official HTTPS source and a past verification date." };
  }

  return { data: {
    name, address, city, province: "Bulacan", scopeVersion: BULACAN_SCOPE_VERSION,
    description: text("description", 500) || null,
    barangay: text("barangay", 120) || null,
    region: text("region", 100) || "Region III",
    latitude, longitude,
    contactNumber: text("contactNumber", 80) || null,
    facilities: [...new Set(facilities as string[])],
    status, verificationStatus, sourceType,
    sourceName: text("sourceName", 160) || null,
    sourceUrl: sourceUrl || null,
    lastVerifiedAt,
    notes: text("notes", 1000) || null,
    estimatedCapacity: capacity,
  } };
}
