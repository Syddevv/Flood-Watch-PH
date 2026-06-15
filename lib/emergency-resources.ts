import type {
  EmergencyContactCategory,
  EvacuationCenterResource,
  EvacuationCenterStatus,
} from "@/lib/types";

export const EVACUATION_STATUS_META: Record<
  EvacuationCenterStatus,
  {
    badgeClassName: string;
    markerColor: string;
    markerRing: string;
  }
> = {
  Available: {
    badgeClassName:
      "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
    markerColor: "#22c55e",
    markerRing: "rgba(34,197,94,0.22)",
  },
  Standby: {
    badgeClassName:
      "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
    markerColor: "#f59e0b",
    markerRing: "rgba(245,158,11,0.2)",
  },
  "Needs Verification": {
    badgeClassName:
      "border-[rgba(59,130,246,0.3)] bg-[rgba(59,130,246,0.08)] text-[#93c5fd]",
    markerColor: "#60a5fa",
    markerRing: "rgba(96,165,250,0.2)",
  },
  "Temporarily Unavailable": {
    badgeClassName:
      "border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.1)] text-[#fca5a5]",
    markerColor: "#ef4444",
    markerRing: "rgba(239,68,68,0.2)",
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

export function buildDirectionsUrl(center: EvacuationCenterResource) {
  const destination = [
    center.name,
    center.address,
    center.barangay,
    center.cityOrMunicipality,
    center.province,
  ]
    .filter(Boolean)
    .join(", ");

  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

export function buildCenterMapHref(centerId: string) {
  return `/?center=${encodeURIComponent(centerId)}`;
}

export function buildCenterDetailsHref(centerId: string) {
  return `/evacuation-centers?center=${encodeURIComponent(centerId)}`;
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
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}
