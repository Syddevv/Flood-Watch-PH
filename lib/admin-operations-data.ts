import "server-only";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { MONITORING_REPORT_STATUSES, RECENT_REPORT_WINDOW_MS } from "@/lib/admin-operations-policy";
import { getAdminSettings } from "@/lib/admin-settings-store";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { currentCenterOpeningStatus } from "@/lib/emergency-resources";
import { prisma } from "@/lib/prisma";

const activeStatuses = [...MONITORING_REPORT_STATUSES];

export type OperationsReport = {
  id: string;
  title: string;
  description: string;
  locationName: string;
  severity: string;
  status: string;
  verificationStatus: string;
  archivedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
};

export type OperationsCenter = {
  id: string;
  name: string;
  address: string;
  barangay: string | null;
  city: string;
  verificationStatus: string;
  openingStatus: ReturnType<typeof currentCenterOpeningStatus>;
  estimatedCapacity: number | null;
  latitude: number | null;
  longitude: number | null;
  updatedAt: string;
};

export type OperationsSnapshot = {
  fetchedAt: string;
  recentReportHours: number;
  summary: {
    reports: number;
    awaitingVerification: number;
    verifiedReports: number;
    activeVerifiedConditions: number;
    activeVerifiedHigh: number;
    centers: number;
    municipalitiesWithCenters: number;
  };
  reports: OperationsReport[];
  centers: OperationsCenter[];
  needsAttention: OperationsReport[];
  recentHighReports: OperationsReport[];
  activity: { id: string; action: string; targetType: string | null; targetId: string | null; createdAt: string; actor: string | null }[];
  limits: { reportsTruncated: boolean; centersTruncated: boolean };
};

function validPoint(latitude: number | null, longitude: number | null) {
  return latitude !== null && longitude !== null && isWithinBulacan(latitude, longitude);
}

const reportSelect = {
  id: true, title: true, description: true, locationName: true, severity: true,
  status: true, verificationStatus: true, archivedAt: true, latitude: true, longitude: true, createdAt: true,
} as const;

function toReport(report: {
  id: string; title: string; description: string; locationName: string; severity: string;
  status: string; verificationStatus: string; archivedAt: Date | null; latitude: number; longitude: number; createdAt: Date;
}): OperationsReport {
  return {
    ...report,
    latitude: validPoint(report.latitude, report.longitude) ? report.latitude : null,
    longitude: validPoint(report.latitude, report.longitude) ? report.longitude : null,
    createdAt: report.createdAt.toISOString(),
    archivedAt: report.archivedAt?.toISOString() ?? null,
  };
}

export async function getAdminOperationsSnapshot(): Promise<OperationsSnapshot> {
  const fetchedAt = new Date();
  const { recentReportHours } = await getAdminSettings();
  const recentSince = new Date(fetchedAt.getTime() - recentReportHours * 60 * 60 * 1000);
  const recentReportWhere = { archivedAt: null, createdAt: { gte: recentSince, lte: fetchedAt }, status: { in: activeStatuses }, verificationStatus: { not: "rejected" } };
  const verifiedConditionWhere = { ...recentReportWhere, createdAt: { gte: new Date(fetchedAt.getTime() - RECENT_REPORT_WINDOW_MS), lte: fetchedAt }, verificationStatus: "verified" };
  const pendingWhere = { ...recentReportWhere, verificationStatus: "unreviewed" };
  const [
    reports, awaitingVerification, verifiedReports, activeVerifiedConditions, activeVerifiedHigh,
    centers, centerRows, reportRows, criticalPending, highPending, otherPending, recentHigh, audits,
  ] = await Promise.all([
    prisma.floodReport.count(),
    prisma.floodReport.count({ where: { archivedAt: null, verificationStatus: "unreviewed" } }),
    prisma.floodReport.count({ where: { verificationStatus: "verified" } }),
    prisma.incident.count({ where: { archivedAt: null, status: { in: activeStatuses }, reports: { some: verifiedConditionWhere } } }),
    prisma.incident.count({ where: { archivedAt: null, status: { in: activeStatuses }, severity: { in: ["High", "Critical"] }, reports: { some: verifiedConditionWhere } } }),
    prisma.evacuationCenter.count({ where: { isArchived: false, province: { equals: "Bulacan", mode: "insensitive" } } }),
    prisma.evacuationCenter.findMany({ where: { isArchived: false, province: { equals: "Bulacan", mode: "insensitive" } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { id: true, name: true, address: true, barangay: true, city: true, verificationStatus: true, status: true, availabilityConfirmedAt: true, estimatedCapacity: true, latitude: true, longitude: true, updatedAt: true } }),
    prisma.floodReport.findMany({ orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 501, select: reportSelect }),
    prisma.floodReport.findMany({ where: { ...pendingWhere, severity: "Critical" }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 5, select: reportSelect }),
    prisma.floodReport.findMany({ where: { ...pendingWhere, severity: "High" }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 5, select: reportSelect }),
    prisma.floodReport.findMany({ where: pendingWhere, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 5, select: reportSelect }),
    prisma.floodReport.findMany({ where: { ...pendingWhere, severity: { in: ["High", "Critical"] } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 3, select: reportSelect }),
    prisma.adminAuditLog.findMany({ where: { OR: [{ action: { startsWith: "ADMIN_REPORT_" } }, { action: { startsWith: "ADMIN_EVACUATION_CENTER_" } }, { action: { startsWith: "ADMIN_EMERGENCY_CONTACT_" } }] }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 5, select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, actor: { select: { fullName: true, email: true } } } }),
  ]);

  const allCenters: OperationsCenter[] = centerRows.map((center) => ({
    id: center.id, name: center.name, address: center.address, barangay: center.barangay,
    city: center.city, verificationStatus: center.verificationStatus,
    openingStatus: currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt, fetchedAt.getTime()),
    estimatedCapacity: center.estimatedCapacity,
    latitude: validPoint(center.latitude, center.longitude) ? center.latitude : null,
    longitude: validPoint(center.latitude, center.longitude) ? center.longitude : null,
    updatedAt: center.updatedAt.toISOString(),
  }));
  const attention = [...criticalPending, ...highPending, ...otherPending].filter((report, index, all) => all.findIndex((other) => other.id === report.id) === index).slice(0, 5);
  const knownLocalities = new Set(BULACAN_LOCALITIES.map((locality) => locality.name.toLocaleLowerCase("en-PH")));
  const municipalitiesWithCenters = new Set(centerRows.map((center) => center.city.toLocaleLowerCase("en-PH")).filter((city) => knownLocalities.has(city))).size;
  allCenters.sort((left, right) => {
    const priority = (center: OperationsCenter) => Number(center.openingStatus !== "unknown") * 2 + Number(center.verificationStatus === "verified" && center.latitude !== null);
    return priority(right) - priority(left);
  });

  return {
    fetchedAt: fetchedAt.toISOString(),
    recentReportHours,
    summary: {
      reports, awaitingVerification, verifiedReports, activeVerifiedConditions, activeVerifiedHigh, centers,
      municipalitiesWithCenters,
    },
    reports: reportRows.slice(0, 500).map(toReport),
    centers: allCenters.slice(0, 500),
    needsAttention: attention.map(toReport),
    recentHighReports: recentHigh.map(toReport),
    activity: audits.map((audit) => ({ id: audit.id, action: audit.action, targetType: audit.targetType, targetId: audit.targetId, createdAt: audit.createdAt.toISOString(), actor: audit.actor?.fullName ?? audit.actor?.email ?? null })),
    limits: { reportsTruncated: reportRows.length > 500, centersTruncated: centerRows.length > 500 },
  };
}
