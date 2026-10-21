import type { EvacuationCenter } from "@prisma/client";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { currentCenterOpeningStatus } from "@/lib/emergency-resources";
import type { EvacuationCenterResource, EvacuationFacility, PublicEvacuationCenter } from "@/lib/types";

const publicSources = new Set(["official_dswd", "official_lgu", "official_government"]);
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
  const hasCoordinates = center.latitude !== null && center.longitude !== null;
  const sourced = center.verificationStatus === "official_publication_found";
  return !center.isArchived &&
    center.province.trim().toLowerCase() === "bulacan" &&
    BULACAN_LOCALITIES.some((locality) => locality.code === center.localityCode && locality.name.toLowerCase() === center.city.trim().toLowerCase()) &&
    (!hasCoordinates || isWithinBulacan(center.latitude!, center.longitude!)) &&
    ((center.latitude === null) === (center.longitude === null)) &&
    (hasCoordinates || sourced) &&
    (center.verificationStatus === "verified" || sourced) &&
    publicSources.has(center.sourceType) &&
    Boolean(center.sourceUrl && isSafeCenterSourceUrl(center.sourceUrl)) &&
    Boolean((center.sourceCheckedAt ?? center.lastVerifiedAt) && (center.sourceCheckedAt ?? center.lastVerifiedAt)! <= new Date());
}

export function toPublicCenter(center: EvacuationCenter) {
  const checkedAt = center.sourceCheckedAt ?? center.lastVerifiedAt;
  const referenceStale = !checkedAt || Date.now() - checkedAt.getTime() > CENTER_REFERENCE_STALE_MS;
  const openingStatus = currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt);
  const availability = openingStatus === "open" ? "confirmed_available"
    : openingStatus === "unknown" ? "unknown" : "confirmed_unavailable";
  const snapshot = center.sourceSnapshot && typeof center.sourceSnapshot === "object" && !Array.isArray(center.sourceSnapshot)
    ? center.sourceSnapshot as { record?: { notes?: string | null; coordinate_precision?: string | null; location_label?: string | null; location_notes?: string | null; location_verification_status?: string | null; latitude?: number | null; longitude?: number | null }; sources?: Array<{ title: string; url: string; published_at: string | null }> }
    : null;
  const sourceCoordinates = snapshot?.record?.latitude === center.latitude && snapshot?.record?.longitude === center.longitude;
  const onlineMappedLocation = sourceCoordinates && snapshot?.record?.location_verification_status === "online_identity_match_not_field_verified";
  const sourceIdentifiesOnlyAnArea = /(?:does not identify the exact building|not the exact facility)/i.test(snapshot?.record?.notes ?? "");
  const officiallyListed = publicSources.has(center.sourceType) &&
    ["verified", "official_publication_found"].includes(center.verificationStatus) &&
    Boolean(center.sourceUrl && isSafeCenterSourceUrl(center.sourceUrl)) && Boolean(checkedAt);
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
    listingKind: officiallyListed ? sourceIdentifiesOnlyAnArea ? "site" : "center" : null,
    openingStatus,
    facilities: center.facilities.filter((facility): facility is EvacuationFacility => publicFacilities.has(facility)),
    estimatedCapacity: center.estimatedCapacity ?? undefined,
    contactNumber: center.contactNumber ?? undefined,
    sourceType: center.sourceType as EvacuationCenterResource["sourceType"],
    sourceName: center.sourceName ?? undefined,
    sourceUrl: center.sourceUrl ?? undefined,
    lastVerifiedAt: checkedAt?.toISOString(),
    sourceCheckedAt: checkedAt?.toISOString() ?? null,
    verificationStatus: referenceStale ? "outdated" : center.verificationStatus as EvacuationCenterResource["verificationStatus"],
    status: openingStatus === "open" ? "available" : openingStatus === "unknown" ? "needs_verification" : openingStatus,
    availability,
    availabilityConfirmedAt: openingStatus !== "unknown" ? center.availabilityConfirmedAt?.toISOString() ?? null : null,
    facilityType: center.facilityType,
    permanent: center.permanent,
    capacityFamilies: center.capacityFamilies,
    lastDocumentedEventDate: center.lastDocumentedEventDate?.toISOString() ?? null,
    sourceLinks: snapshot?.sources?.filter((source) => isSafeCenterSourceUrl(source.url)).map((source) => ({ title: source.title, url: source.url, publishedAt: source.published_at })) ?? [],
    sourceNotes: snapshot?.record?.notes ?? null,
    locationProvenance: center.latitude === null ? null : !sourceCoordinates && center.updatedByUserId ? "Admin-updated location; confirm locally"
      : onlineMappedLocation ? `Online-mapped ${snapshot?.record?.coordinate_precision === "mapped_place" ? "place" : snapshot?.record?.coordinate_precision ?? "facility"} location; not field-confirmed`
      : snapshot?.record?.coordinate_precision ? "Source-published location; not field-confirmed" : null,
    locationNotes: onlineMappedLocation ? snapshot?.record?.location_notes ?? null : null,
  };
  return resource;
}
