import type { EvacuationCenter } from "@prisma/client";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import type { EvacuationCenterResource, EvacuationFacility, PublicEvacuationCenter } from "@/lib/types";

const publicSources = new Set(["official_dswd", "official_lgu"]);
const publicFacilities = new Set([
  "pwd_accessible", "medical_support", "drinking_water", "restrooms", "pet_friendly", "parking",
]);
const CENTER_REFERENCE_STALE_MS = 90 * 24 * 60 * 60 * 1000;

export function isSafeCenterSourceUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function isPublishableCenter(center: EvacuationCenter) {
  return !center.isArchived &&
    center.province.trim().toLowerCase() === "bulacan" &&
    BULACAN_LOCALITIES.some((locality) => locality.name.toLowerCase() === center.city.trim().toLowerCase()) &&
    isWithinBulacan(center.latitude, center.longitude) &&
    center.verificationStatus === "verified" &&
    publicSources.has(center.sourceType) &&
    Boolean(center.sourceUrl && isSafeCenterSourceUrl(center.sourceUrl)) &&
    Boolean(center.lastVerifiedAt && center.lastVerifiedAt <= new Date());
}

export function toPublicCenter(center: EvacuationCenter) {
  const referenceStale = !center.lastVerifiedAt || Date.now() - center.lastVerifiedAt.getTime() > CENTER_REFERENCE_STALE_MS;
  const availabilityFresh = !referenceStale && center.availabilityConfirmedAt &&
    Date.now() - center.availabilityConfirmedAt.getTime() <= 24 * 60 * 60 * 1000;
  const availability = availabilityFresh && center.status === "available"
    ? "confirmed_available"
    : availabilityFresh && center.status === "temporarily_unavailable"
      ? "confirmed_unavailable"
      : "unknown";
  const resource: PublicEvacuationCenter = {
    id: center.id,
    name: center.name,
    address: center.address,
    barangay: center.barangay ?? undefined,
    city: center.city,
    province: center.province,
    region: center.region ?? undefined,
    latitude: center.latitude,
    longitude: center.longitude,
    facilities: center.facilities.filter((facility): facility is EvacuationFacility => publicFacilities.has(facility)),
    estimatedCapacity: center.estimatedCapacity ?? undefined,
    contactNumber: center.contactNumber ?? undefined,
    sourceType: center.sourceType as EvacuationCenterResource["sourceType"],
    sourceName: center.sourceName ?? undefined,
    sourceUrl: center.sourceUrl ?? undefined,
    lastVerifiedAt: center.lastVerifiedAt?.toISOString(),
    verificationStatus: referenceStale ? "outdated" : "verified",
    status: availability === "confirmed_available" ? "available" : availability === "confirmed_unavailable" ? "temporarily_unavailable" : "needs_verification",
    availability,
    availabilityConfirmedAt: availabilityFresh ? center.availabilityConfirmedAt?.toISOString() ?? null : null,
  };
  return resource;
}
