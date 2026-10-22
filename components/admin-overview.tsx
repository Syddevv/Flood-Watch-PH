"use client";

import Link from "next/link";
import { Building2, FileText, MapPinned, RefreshCw, ShieldCheck } from "lucide-react";
import { AdminOperationsMap } from "@/components/admin-operations-map";
import { useAdminOperations } from "@/components/use-admin-operations";
import { compactBulacanPlace, isRecentMonitoringReport, relativeOperationalTime } from "@/lib/admin-operations-policy";
import { centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

const card = "rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5";

function activityTitle(action: string) {
  const titles: Record<string, string> = {
    ADMIN_REPORT_VERIFICATION_CHANGED: "Report review updated",
    ADMIN_REPORT_STATUS_CHANGED: "Report status updated",
    ADMIN_REPORT_NOTE_ADDED: "Report note added",
    ADMIN_REPORT_CREATED: "Report created",
    ADMIN_EVACUATION_CENTER_UPDATED: "Evacuation center updated",
    ADMIN_EVACUATION_CENTER_CREATED: "Evacuation center added",
    ADMIN_EMERGENCY_CONTACT_UPDATED: "Emergency contact updated",
  };
  return titles[action] ?? formatUiLabel(action.replace(/^ADMIN_/, "").toLowerCase());
}

function activityEntity(type: string | null) {
  if (type === "FloodReport") return "Flood report";
  if (type === "EvacuationCenter") return "Evacuation center";
  if (type === "EmergencyContact") return "Emergency contact";
  return "Administrative record";
}

function activityHref(type: string | null, id: string | null) {
  if (type === "FloodReport" && id) return `/admin/reports/${id}`;
  if (type === "EvacuationCenter" && id) return `/admin/data/${id}`;
  if (type === "EmergencyContact") return "/admin/emergency-contacts";
  return null;
}

export function AdminOverview() {
  const { data, loading, refreshing, error, refresh } = useAdminOperations();
  const now = data ? Date.parse(data.fetchedAt) : 0;
  const recentMappedReports = data?.reports.filter((report) => isRecentMonitoringReport(report, now, data.recentReportHours * 3_600_000) && report.latitude !== null).slice(0, 80) ?? [];
  const mappedCenters = data?.centers.filter((center) => center.latitude !== null).slice(0, 30) ?? [];
  const summary = data?.summary;

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Operations Overview</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Recent reports, verified conditions, and evacuation centers across Bulacan.</p></div>
      <div className="flex flex-wrap gap-2"><Link href="/admin/map" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white"><MapPinned className="h-4 w-4" />Open Live Map</Link><Link href="/admin/reports" className="inline-flex h-10 items-center rounded-lg border border-[var(--color-border)] px-4 text-sm font-semibold">Review Flood Reports</Link></div>
    </header>
    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--color-muted-foreground)]"><span>{data ? `Updated ${formatOperationalUpdate(data.fetchedAt)} · refreshes every minute` : loading ? "Loading operational records…" : "Operational records unavailable"}</span><button type="button" onClick={() => void refresh()} disabled={refreshing} className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div>
    {error ? <p role="alert" className="rounded-lg border border-[var(--color-border)] p-4 text-sm text-[var(--color-danger)]">{error}</p> : null}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy={loading}>
      <article className={card}><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Flood Reports</h3><FileText aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" /></div><p className="mt-2 text-3xl font-bold">{summary?.reports ?? "—"}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">All-time submissions · {summary ? `${summary.awaitingVerification} awaiting review` : "pending count loading"}</p></article>
      <article className={card}><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Verified Flood Conditions</h3><ShieldCheck aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" /></div><p className="mt-2 text-3xl font-bold">{summary?.activeVerifiedConditions ?? "—"}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Recent 72 hours · {summary ? `${summary.activeVerifiedHigh} high or critical` : "verified reports"}</p></article>
      <article className={card}><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Evacuation Centers</h3><Building2 aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" /></div><p className="mt-2 text-3xl font-bold">{summary?.centers ?? "—"}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Registered across Bulacan</p></article>
      <article className={card}><div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Municipalities with Centers</h3><MapPinned aria-hidden="true" className="h-4 w-4 text-[var(--color-primary)]" /></div><p className="mt-2 text-3xl font-bold">{summary?.municipalitiesWithCenters ?? "—"}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Based on center directory locations</p></article>
    </div>
    {data?.recentHighReports.length ? <section className="rounded-xl border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-4 py-3"><h3 className="text-sm font-semibold">High-severity reports awaiting review</h3><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Recent submissions, not official warnings.</p><div className="mt-2 flex flex-wrap gap-2">{data.recentHighReports.map((report) => <Link key={report.id} href={`/admin/reports/${report.id}`} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-xs font-medium hover:underline">{report.title} · {report.severity}</Link>)}</div></section> : null}
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,1fr)]">
      <section className={`${card} min-w-0`}><div className="mb-3 flex items-center justify-between gap-3"><div><h3 className="font-semibold">Recent Reports Map</h3><p className="text-xs text-[var(--color-muted-foreground)]">Reports from the past {data?.recentReportHours ?? 72} hours and registered centers</p></div><Link href="/admin/map" className="shrink-0 text-sm font-semibold text-[var(--color-primary)] hover:underline">Expand Map</Link></div><div className="h-[280px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-map-shell)] sm:h-[300px]">{data ? <AdminOperationsMap reports={recentMappedReports} centers={mappedCenters} asOf={now} recentReportWindowMs={data.recentReportHours * 3_600_000} /> : <div className="grid h-full place-items-center text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading map…" : "Map unavailable"}</div>}</div></section>
      <section className={card}><div className="flex items-center justify-between"><h3 className="font-semibold">Needs Attention</h3><Link href="/admin/reports" className="text-xs font-semibold text-[var(--color-primary)]">View All Reports</Link></div><div className="mt-2 divide-y divide-[var(--color-border)]">{data?.needsAttention.length ? data.needsAttention.map((report) => <Link key={report.id} href={`/admin/reports/${report.id}`} className="block py-2.5 hover:text-[var(--color-primary)]"><span className="block truncate text-sm font-semibold" title={report.title}>{report.title}</span><span className="mt-1 block truncate text-xs text-[var(--color-muted-foreground)]">{compactBulacanPlace(report.locationName)}</span><span className="mt-1 flex flex-wrap items-center gap-x-2 text-xs"><span className="font-medium text-[var(--color-warning)]">{report.severity}</span><span>{formatUiLabel(report.verificationStatus)}</span><time dateTime={report.createdAt} title={formatOperationalUpdate(report.createdAt)} className="text-[var(--color-muted-foreground)]">{relativeOperationalTime(report.createdAt, now)}</time></span></Link>) : <p className="py-5 text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading reports…" : "No recent reports awaiting review."}</p>}</div></section>
    </div>
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section className={card}><div className="flex items-center justify-between"><h3 className="font-semibold">Evacuation Centers</h3><Link href="/admin/data" className="text-xs font-semibold text-[var(--color-primary)]">Manage Centers</Link></div><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Opening is unconfirmed unless a recent confirmation is shown.</p><div className="mt-2 divide-y divide-[var(--color-border)]">{data?.centers.length ? data.centers.slice(0, 5).map((center) => <Link key={center.id} href={`/admin/data/${center.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-[var(--color-primary)]"><span className="min-w-0"><span className="block truncate font-semibold">{center.name}</span><span className="block truncate text-xs text-[var(--color-muted-foreground)]">{center.city}{center.estimatedCapacity !== null ? ` · Estimated capacity ${center.estimatedCapacity}` : ""}</span></span>{center.openingStatus !== "unknown" ? <span className="shrink-0 text-xs font-medium">{centerOpeningLabel(center)}</span> : null}</Link>) : <p className="py-5 text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading centers…" : "No registered centers."}</p>}</div></section>
      <section className={card}><h3 className="font-semibold">Recent Administrative Activity</h3><div className="mt-2 divide-y divide-[var(--color-border)]">{data?.activity.length ? data.activity.map((item) => {
        const href = activityHref(item.targetType, item.targetId);
        return <div key={item.id} className="py-2.5"><p className="text-sm font-medium">{href ? <Link href={href} className="hover:text-[var(--color-primary)] hover:underline">{activityTitle(item.action)}</Link> : activityTitle(item.action)}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{activityEntity(item.targetType)} · <time dateTime={item.createdAt} title={formatOperationalUpdate(item.createdAt)}>{relativeOperationalTime(item.createdAt, now)}</time>{item.actor ? ` · ${item.actor}` : ""}</p></div>;
      }) : <p className="py-5 text-sm text-[var(--color-muted-foreground)]">{loading ? "Loading activity…" : "No recent operational changes."}</p>}</div></section>
    </div>
  </div>;
}
