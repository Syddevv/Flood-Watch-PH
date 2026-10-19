import { deriveReportLifecycleStatus } from "@/lib/report-lifecycle";
import { reviewEvidenceSummary } from "@/lib/report-review";

type AdminReportRecord = {
  id: string;
  title: string;
  locationName: string;
  latitude: number;
  longitude: number;
  category: string;
  severity: string;
  status: string;
  verificationStatus: string;
  reviewVersion: number;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  confirmationCount: number;
  resolvedCount: number;
  incidentId: string;
  imageUrl: string | null;
  onsiteEligibleAt: Date | null;
  gpsCapturedAt: Date | null;
  photoCapturedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt: Date;
  user?: { id: string; email: string; displayName: string | null } | null;
  incident?: { reportCount: number } | null;
};

export function toAdminReportDto(report: AdminReportRecord) {
  return {
    id: report.id,
    title: report.title,
    locationName: report.locationName,
    latitude: report.latitude,
    longitude: report.longitude,
    category: report.category,
    severity: report.severity,
    publicStatus: deriveReportLifecycleStatus(report),
    verificationStatus: report.verificationStatus,
    reviewVersion: report.reviewVersion,
    reviewedAt: report.reviewedAt?.toISOString() ?? null,
    reviewedByUserId: report.reviewedByUserId,
    evidence: reviewEvidenceSummary(report),
    incidentId: report.incidentId,
    incidentReportCount: report.incident?.reportCount ?? 1,
    hasPhoto: Boolean(report.imageUrl),
    reporter: report.user
      ? { id: report.user.id, email: report.user.email, displayName: report.user.displayName }
      : null,
    createdAt: report.createdAt.toISOString(),
    lastActivityAt: report.lastActivityAt.toISOString(),
  };
}
