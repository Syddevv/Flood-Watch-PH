import { adminErrorResponse, adminSuccessResponse } from "@/lib/admin-api-response";
import { requireProtectedAdminApi } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { deriveReportLifecycleStatus } from "@/lib/report-lifecycle";
import { inferAdminReportStatus } from "@/lib/admin-contracts";
import { createBoundingBox, calculateDistanceMeters } from "@/lib/report-geo";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireProtectedAdminApi(request, { scope: "admin-report-detail", limit: 120, windowMs: 60_000 });
  if (auth.response) return auth.response;
  const { id } = await context.params;
  const report = await prisma.floodReport.findUnique({ where: { id }, include: { user: { select: { id: true, email: true, displayName: true } }, reviewer: { select: { id: true, displayName: true, email: true } }, incident: { include: { reports: { select: { id: true, title: true, severity: true, status: true, verificationStatus: true, locationName: true, createdAt: true } } } }, updates: { orderBy: { createdAt: "desc" } }, confirmations: { orderBy: { createdAt: "desc" } } } });
  if (!report) return adminErrorResponse(request, "Report not found.", 404);
  const actions = await prisma.adminOperationalAction.findMany({ where: { targetType: "FloodReport", targetId: id }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, actionType: true, previousValue: true, nextValue: true, visibility: true, note: true, actorUserId: true, createdAt: true } });
  const actors = await prisma.user.findMany({ where: { id: { in: actions.map((action) => action.actorUserId).filter((actorId): actorId is string => Boolean(actorId)) } }, select: { id: true, displayName: true, email: true } });
  const actorNames = new Map(actors.map((actor) => [actor.id, actor.displayName ?? actor.email]));
  const bounds = createBoundingBox(report.latitude, report.longitude, 500);
  const nearby = await prisma.floodReport.findMany({ where: { id: { not: id }, latitude: { gte: bounds.minLatitude, lte: bounds.maxLatitude }, longitude: { gte: bounds.minLongitude, lte: bounds.maxLongitude } }, select: { id: true, title: true, locationName: true, verificationStatus: true, latitude: true, longitude: true }, take: 100 });
  const nearbyReports = nearby.map((entry) => ({ id: entry.id, title: entry.title, locationName: entry.locationName, verificationStatus: entry.verificationStatus, distanceMeters: Math.round(calculateDistanceMeters(report, entry)) })).filter((entry) => entry.distanceMeters <= 500).sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 5);
  const latestStatus = actions.find((action) => action.actionType === "status_change" || action.actionType === "resolution")?.nextValue;
  return adminSuccessResponse(request, { report: { ...report, nearbyReports, adminStatus: inferAdminReportStatus(report, latestStatus), publicStatus: deriveReportLifecycleStatus(report), createdAt: report.createdAt.toISOString(), updatedAt: report.updatedAt.toISOString(), lastActivityAt: report.lastActivityAt.toISOString(), photoCapturedAt: report.photoCapturedAt?.toISOString() ?? null, resolvedAt: report.resolvedAt?.toISOString() ?? null, archivedAt: report.archivedAt?.toISOString() ?? null, actions: actions.map((action) => ({ ...action, actorName: action.actorUserId ? actorNames.get(action.actorUserId) ?? "Former administrator" : "System", createdAt: action.createdAt.toISOString() })) } });
}
