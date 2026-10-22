import "server-only";

import { isWithinBulacan } from "@/lib/bulacan-scope";
import { currentCenterOpeningStatus } from "@/lib/emergency-resources";
import { prisma } from "@/lib/prisma";

const activeStatuses = ["Needs More Confirmation", "Confirmed by Community"];

export type OperationsReport = {
  id: string;
  title: string;
  description: string;
  locationName: string;
  severity: string;
  status: string;
  verificationStatus: string;
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
};

export type OperationsSnapshot = {
  fetchedAt: string;
  summary: {
    reports: number;
    awaitingVerification: number;
    verifiedReports: number;
    activeVerifiedConditions: number;
    activeVerifiedHigh: number;
    centers: number;
    confirmedOpenCenters: number;
    verifiedMappedCenters: number;
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
  status: true, verificationStatus: true, latitude: true, longitude: true, createdAt: true,
} as const;

function toReport(report: {
  id: string; title: string; description: string; locationName: string; severity: string;
  status: string; verificationStatus: string; latitude: number; longitude: number; createdAt: Date;
}): OperationsReport {
  return {
    ...report,
    latitude: validPoint(report.latitude, report.longitude) ? report.latitude : null,
    longitude: validPoint(report.latitude, report.longitude) ? report.longitude : null,
    createdAt: report.createdAt.toISOString(),
  };
}

export async function getAdminOperationsSnapshot(): Promise<OperationsSnapshot> {
  const fetchedAt = new Date();
  const [
    reports, awaitingVerification, verifiedReports, activeVerifiedConditions, activeVerifiedHigh,
    centers, centerRows, reportRows, highPriority, olderPending, recentHigh, audits,
  ] = await Promise.all([
    prisma.floodReport.count(),
    prisma.floodReport.count({ where: { archivedAt: null, verificationStatus: "unreviewed" } }),
    prisma.floodReport.count({ where: { verificationStatus: "verified" } }),
    prisma.incident.count({ where: { archivedAt: null, status: { in: activeStatuses }, reports: { some: { archivedAt: null, verificationStatus: "verified" } } } }),
    prisma.incident.count({ where: { archivedAt: null, status: { in: activeStatuses }, severity: { in: ["High", "Critical"] }, reports: { some: { archivedAt: null, verificationStatus: "verified" } } } }),
    prisma.evacuationCenter.count({ where: { isArchived: false, province: { equals: "Bulacan", mode: "insensitive" } } }),
    prisma.evacuationCenter.findMany({ where: { isArchived: false, province: { equals: "Bulacan", mode: "insensitive" } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], select: { id: true, name: true, address: true, barangay: true, city: true, verificationStatus: true, status: true, availabilityConfirmedAt: true, estimatedCapacity: true, latitude: true, longitude: true } }),
    prisma.floodReport.findMany({ where: { archivedAt: null }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 501, select: reportSelect }),
    prisma.floodReport.findMany({ where: { archivedAt: null, verificationStatus: "unreviewed", severity: { in: ["High", "Critical"] } }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 6, select: reportSelect }),
    prisma.floodReport.findMany({ where: { archivedAt: null, verificationStatus: "unreviewed" }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 6, select: reportSelect }),
    prisma.floodReport.findMany({ where: { archivedAt: null, verificationStatus: "unreviewed", severity: { in: ["High", "Critical"] }, createdAt: { gte: new Date(fetchedAt.getTime() - 24 * 60 * 60 * 1000) } }, orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 3, select: reportSelect }),
    prisma.adminAuditLog.findMany({ orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 6, select: { id: true, action: true, targetType: true, targetId: true, createdAt: true, actor: { select: { fullName: true, email: true } } } }),
  ]);

  const allCenters: OperationsCenter[] = centerRows.map((center) => ({
    id: center.id, name: center.name, address: center.address, barangay: center.barangay,
    city: center.city, verificationStatus: center.verificationStatus,
    openingStatus: currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt, fetchedAt.getTime()),
    estimatedCapacity: center.estimatedCapacity,
    latitude: validPoint(center.latitude, center.longitude) ? center.latitude : null,
    longitude: validPoint(center.latitude, center.longitude) ? center.longitude : null,
  }));
  const attention = [...highPriority, ...olderPending].filter((report, index, all) => all.findIndex((other) => other.id === report.id) === index).slice(0, 6);

  return {
    fetchedAt: fetchedAt.toISOString(),
    summary: {
      reports, awaitingVerification, verifiedReports, activeVerifiedConditions, activeVerifiedHigh, centers,
      confirmedOpenCenters: allCenters.filter((center) => center.openingStatus === "open").length,
      verifiedMappedCenters: allCenters.filter((center) => center.verificationStatus === "verified" && center.latitude !== null).length,
    },
    reports: reportRows.slice(0, 500).map(toReport),
    centers: allCenters.slice(0, 500),
    needsAttention: attention.map(toReport),
    recentHighReports: recentHigh.map(toReport),
    activity: audits.map((audit) => ({ id: audit.id, action: audit.action, targetType: audit.targetType, targetId: audit.targetId, createdAt: audit.createdAt.toISOString(), actor: audit.actor?.fullName ?? audit.actor?.email ?? null })),
    limits: { reportsTruncated: reportRows.length > 500, centersTruncated: centerRows.length > 500 },
  };
}
