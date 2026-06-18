import type {
  EmergencyContactCategory,
  EvacuationCenterResource,
  EvacuationCenterSourceType,
  EvacuationCenterStatus,
  EvacuationCenterVerificationStatus,
  EvacuationFacility,
} from "@/lib/types";

export const EVACUATION_STATUS_META: Record<
  EvacuationCenterStatus,
  {
    label: string;
    badgeClassName: string;
    markerColor: string;
    markerRing: string;
  }
> = {
  available: {
    label: "Available",
    badgeClassName:
      "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
    markerColor: "#22c55e",
    markerRing: "rgba(34,197,94,0.22)",
  },
  standby: {
    label: "Standby",
    badgeClassName:
      "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
    markerColor: "#f59e0b",
    markerRing: "rgba(245,158,11,0.2)",
  },
  needs_verification: {
    label: "Needs Verification",
    badgeClassName:
      "border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.08)] text-[#93c5fd]",
    markerColor: "#60a5fa",
    markerRing: "rgba(96,165,250,0.2)",
  },
  temporarily_unavailable: {
    label: "Temporarily Unavailable",
    badgeClassName:
      "border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.1)] text-[#fca5a5]",
    markerColor: "#ef4444",
    markerRing: "rgba(239,68,68,0.2)",
  },
};

export const EVACUATION_VERIFICATION_META: Record<
  EvacuationCenterVerificationStatus,
  {
    label: string;
    badgeClassName: string;
  }
> = {
  verified: {
    label: "Verified reference",
    badgeClassName:
      "border-[rgba(34,197,94,0.22)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
  },
  needs_verification: {
    label: "Needs verification",
    badgeClassName:
      "border-[rgba(59,130,246,0.22)] bg-[rgba(59,130,246,0.08)] text-[#93c5fd]",
  },
  sample_demo: {
    label: "Sample/demo",
    badgeClassName:
      "border-[rgba(148,163,184,0.2)] bg-[rgba(148,163,184,0.08)] text-[var(--color-muted-foreground)]",
  },
  outdated: {
    label: "Outdated reference",
    badgeClassName:
      "border-[rgba(245,158,11,0.22)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
  },
};

export const EVACUATION_SOURCE_META: Record<
  EvacuationCenterSourceType,
  {
    label: string;
  }
> = {
  official_dswd: {
    label: "Official DSWD Reference",
  },
  official_lgu: {
    label: "Official LGU Reference",
  },
  openstreetmap: {
    label: "OpenStreetMap Reference",
  },
  community_reference: {
    label: "Community Reference",
  },
  sample_demo: {
    label: "FloodWatch PH Reference Dataset",
  },
};

export const EVACUATION_FACILITY_META: Record<
  EvacuationFacility,
  {
    label: string;
    searchAliases?: string[];
  }
> = {
  pwd_accessible: {
    label: "PWD Accessible",
    searchAliases: ["pwd", "accessible"],
  },
  medical_support: {
    label: "Medical Support",
    searchAliases: ["medical", "clinic", "support"],
  },
  drinking_water: {
    label: "Drinking Water",
    searchAliases: ["water"],
  },
  restrooms: {
    label: "Restrooms",
    searchAliases: ["toilet", "bathroom"],
  },
  pet_friendly: {
    label: "Pet Friendly",
    searchAliases: ["pets", "pet"],
  },
  parking: {
    label: "Parking",
  },
};

export const EMERGENCY_CONTACT_CATEGORY_ACCENTS: Record<
  EmergencyContactCategory,
  string
> = {
  "Disaster Coordination": "text-[var(--color-primary)]",
  "Weather Updates": "text-sky-300",
  "Local Response": "text-amber-300",
  "Barangay Hotline": "text-emerald-300",
  Police: "text-rose-300",
  Fire: "text-orange-300",
  Ambulance: "text-lime-300",
};

export function formatLastVerified(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function formatEvacuationFacilityLabel(facility: EvacuationFacility) {
  return EVACUATION_FACILITY_META[facility].label;
}

export function formatEvacuationStatusLabel(status: EvacuationCenterStatus) {
  return EVACUATION_STATUS_META[status].label;
}

export function formatEvacuationSourceLabel(sourceType: EvacuationCenterSourceType) {
  return EVACUATION_SOURCE_META[sourceType].label;
}

export function formatEvacuationVerificationLabel(
  verificationStatus: EvacuationCenterVerificationStatus,
) {
  return EVACUATION_VERIFICATION_META[verificationStatus].label;
}

export function buildEvacuationCenterLocationLabel(center: EvacuationCenterResource) {
  return [center.barangay, center.city, center.province].filter(Boolean).join(", ");
}

export function formatEstimatedCapacity(value: number) {
  return new Intl.NumberFormat("en-PH").format(value);
}

export function buildEvacuationCenterSearchIndex(center: EvacuationCenterResource) {
  const facilityTerms = center.facilities.flatMap((facility) => {
    const meta = EVACUATION_FACILITY_META[facility];
    return [meta.label, ...(meta.searchAliases ?? [])];
  });

  return [
    center.name,
    center.address,
    center.barangay,
    center.city,
    center.province,
    center.region,
    center.sourceName,
    formatEvacuationSourceLabel(center.sourceType),
    formatEvacuationVerificationLabel(center.verificationStatus),
    ...facilityTerms,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function buildDirectionsUrl(
  center: EvacuationCenterResource,
  origin?: { latitude: number; longitude: number } | null,
) {
  const destination = `${center.latitude},${center.longitude}`;

  if (origin) {
    const originValue = `${origin.latitude},${origin.longitude}`;

    return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originValue)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
}

export function buildCenterMapHref(centerId: string) {
  return `/?center=${encodeURIComponent(centerId)}`;
}

export function buildCenterDetailsHref(centerId: string) {
  return `/evacuation-centers?center=${encodeURIComponent(centerId)}`;
}

export function summarizeEvacuationFacilities(facilities: EvacuationFacility[], limit = 3) {
  const visible = facilities.slice(0, limit).map(formatEvacuationFacilityLabel);
  const remaining = facilities.length - visible.length;

  return {
    visible,
    remaining,
  };
}

export function calculateDistanceKm(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
) {
  const earthRadiusKm = 6371;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const latitudeDelta = toRadians(destination.latitude - origin.latitude);
  const longitudeDelta = toRadians(destination.longitude - origin.longitude);
  const originLatitude = toRadians(origin.latitude);
  const destinationLatitude = toRadians(destination.latitude);

  const haversine =
    Math.sin(latitudeDelta / 2) * Math.sin(latitudeDelta / 2) +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) *
      Math.sin(longitudeDelta / 2);

  const arc = 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  return earthRadiusKm * arc;
}

export function formatDistanceKm(distanceKm: number) {
  return `~${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km direct distance`;
}
