import {
  INCIDENT_MATCH_RADIUS_METERS,
  INCIDENT_MATCH_TIME_WINDOW_MS,
} from "@/lib/incident-config";
import { calculateDistanceMeters } from "@/lib/report-geo";
import {
  deriveReportLifecycleStatus,
  getLastActivityDate,
  isActiveLifecycleStatus,
} from "@/lib/report-lifecycle";

export type IncidentMatchCandidate = {
  incidentId: string;
  latitude: number;
  longitude: number;
  status?: string | null;
  severity: string;
  confirmationCount: number;
  resolvedCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
  lastActivityAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  archivedAt?: Date | string | null;
};

export type IncidentMatchOptions = {
  radiusMeters?: number;
  timeWindowMs?: number;
};

export type IncidentMatchResult = {
  incidentId: string;
  distanceMeters: number;
};

export function findNearestMatchingReport(
  candidates: IncidentMatchCandidate[],
  origin: { latitude: number; longitude: number },
  now: Date,
  options: IncidentMatchOptions = {},
): IncidentMatchResult | null {
  const radiusMeters = options.radiusMeters ?? INCIDENT_MATCH_RADIUS_METERS;
  const timeWindowMs = options.timeWindowMs ?? INCIDENT_MATCH_TIME_WINDOW_MS;

  const eligible = candidates
    .filter((candidate) =>
      isActiveLifecycleStatus(deriveReportLifecycleStatus(candidate, now)),
    )
    .filter(
      (candidate) =>
        now.getTime() - getLastActivityDate(candidate).getTime() <= timeWindowMs,
    )
    .map((candidate) => ({
      incidentId: candidate.incidentId,
      distanceMeters: calculateDistanceMeters(origin, candidate),
    }))
    .filter((entry) => entry.distanceMeters <= radiusMeters)
    .sort((left, right) => left.distanceMeters - right.distanceMeters);

  return eligible[0] ?? null;
}
