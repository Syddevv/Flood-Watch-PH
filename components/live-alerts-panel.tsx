"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CloudRain,
  Clock3,
  MapPinned,
  Megaphone,
  Route,
  ShieldCheck,
  ThumbsUp,
  X,
} from "lucide-react";

import { formatCountLabel } from "@/lib/reporting";
import {
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  getReportActivityLabel,
  getReportFreshnessBadge,
} from "@/lib/report-trust";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";

type LiveAlertGroup = {
  id: string;
  title: string;
  description: string;
  reports: IncidentReport[];
};

type LiveAlertTabId = "all" | "critical" | "high-risk" | "nearby" | "recent" | "receded";

type LiveAlertSummary = {
  criticalCount: number;
  highRiskCount: number;
  recentlyUpdatedCount: number;
  nearbyActiveCount?: number;
};

type NearbyLocationStatus = "idle" | "loading" | "available" | "denied" | "unavailable" | "error";

type LiveAlertsPanelProps = {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  groups: LiveAlertGroup[];
  summary: LiveAlertSummary;
  nearbyLocationStatus?: NearbyLocationStatus;
  nearbyLocationError?: string | null;
  nearbyRadiusLabel?: string;
  onRequestNearbyLocation?: () => void;
  onClose: () => void;
  onViewOnMap: (reportId: string) => void;
  onViewDetails: (reportId: string) => void;
  onViewAllReports: () => void;
  onOpenFloodMap: () => void;
  onReportFlood: () => void;
  onFindEvacuationCenters: () => void;
  onReviewWeatherRisk: () => void;
};

const filterTabs: { id: LiveAlertTabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "critical", label: "Critical" },
  { id: "high-risk", label: "High Risk" },
  { id: "nearby", label: "Nearby" },
  { id: "recent", label: "Recent" },
  { id: "receded", label: "Receded" },
];

const safetyReminders = [
  "Avoid flooded roads",
  "Do not walk or drive through floodwater",
  "Move to higher ground if water is rising",
  "Check nearby evacuation centers",
];

export function LiveAlertsPanel({
  open,
  loading = false,
  error = null,
  groups,
  summary,
  nearbyLocationStatus = "idle",
  nearbyLocationError = null,
  nearbyRadiusLabel = "15 km",
  onRequestNearbyLocation,
  onClose,
  onViewOnMap,
  onViewDetails,
  onViewAllReports,
  onOpenFloodMap,
  onReportFlood,
  onFindEvacuationCenters,
  onReviewWeatherRisk,
}: LiveAlertsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [activeTab, setActiveTab] = useState<LiveAlertTabId>("all");

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) {
        return;
      }

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );

      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const visibleGroups = useMemo(() => {
    if (activeTab === "all") {
      return groups.filter((group) => group.reports.length > 0);
    }

    return groups.filter((group) => group.id === activeTab && group.reports.length > 0);
  }, [activeTab, groups]);

  const activeReportCount = useMemo(() => {
    const activeReportIds = new Set<string>();

    for (const group of groups) {
      if (group.id === "receded") {
        continue;
      }

      for (const report of group.reports) {
        activeReportIds.add(report.id);
      }
    }

    return activeReportIds.size;
  }, [groups]);
  const hasAnyVisibleReports = visibleGroups.length > 0;
  const hasCriticalAlerts = summary.criticalCount > 0;
  const showNoActiveReportsEmpty = activeReportCount === 0 && activeTab !== "receded";
  const showNearbyLocationHint =
    activeTab === "nearby" && (summary.nearbyActiveCount ?? 0) === 0 && activeReportCount > 0;
  const nearbyLocationMessage =
    nearbyLocationStatus === "loading"
      ? "Finding nearby flood reports..."
      : nearbyLocationStatus === "available"
        ? `No active flood reports found within ${nearbyRadiusLabel} of your current location.`
        : nearbyLocationStatus === "denied"
          ? (nearbyLocationError ?? "Location permission is blocked for FloodWatch PH.")
          : nearbyLocationStatus === "unavailable"
            ? (nearbyLocationError ?? "Location is not available in this browser.")
            : nearbyLocationStatus === "error"
              ? (nearbyLocationError ?? "We could not read your current location. Please try again.")
              : "Enable location to see nearby flood reports.";
  const canRequestNearbyLocation =
    Boolean(onRequestNearbyLocation) &&
    nearbyLocationStatus !== "loading" &&
    nearbyLocationStatus !== "available";

  const quickActions = [
    { label: "Check map reports", icon: MapPinned, onClick: onViewAllReports },
    { label: "Find evacuation centers", icon: Building2, onClick: onFindEvacuationCenters },
    { label: "Review weather risk", icon: CloudRain, onClick: onReviewWeatherRisk },
    { label: "Report flooding", icon: Megaphone, onClick: onReportFlood },
  ];

  if (!open) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-sheet-backdrop)]"
        onClick={onClose}
      />
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--layer-sheet)] flex justify-end md:inset-y-[calc(var(--header-height)+1rem)] md:right-4 md:left-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-alerts-title"
          className="pointer-events-auto flex max-h-[82dvh] w-full max-w-[26rem] flex-col rounded-t-[18px] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:h-full md:max-h-none md:rounded-[16px]"
        >
          <div className="shrink-0 border-b border-[color:color-mix(in_srgb,var(--color-border)_60%,transparent)] px-4 pb-3 pt-3">
            <div className="flex justify-center md:hidden">
              <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 md:mt-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-[10px] bg-[color:color-mix(in_srgb,var(--color-danger)_14%,var(--color-surface))] text-[var(--color-danger)]">
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </span>
                  <div>
                    <h2
                      id="live-alerts-title"
                      className="text-[0.96rem] font-semibold text-[var(--color-foreground)]"
                    >
                      Live Alerts
                    </h2>
                    <p className="text-[0.74rem] text-[var(--color-muted-foreground)]">
                      Active flood updates and safety checks
                    </p>
                  </div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close live alerts"
                onClick={onClose}
                className="inline-flex h-8 w-8 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {[
                { label: "Critical", value: summary.criticalCount },
                { label: "High risk", value: summary.highRiskCount },
                { label: "Recent", value: summary.recentlyUpdatedCount },
                { label: "Nearby", value: summary.nearbyActiveCount ?? 0 },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-full border border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_80%,transparent)] px-2.5 py-1 text-[0.72rem] font-medium text-[var(--color-muted-foreground)]"
                >
                  <span className="font-mono font-semibold tabular-nums text-[var(--color-foreground)]">
                    {item.value}
                  </span>{" "}
                  {item.label}
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-[0.72rem] font-medium",
                    activeTab === tab.id
                      ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {!hasCriticalAlerts && !loading && !error && activeReportCount > 0 ? (
              <div className="mb-2 rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_58%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_72%,transparent)] px-3 py-2 text-[0.76rem] leading-5 text-[var(--color-muted-foreground)]">
                <span className="font-semibold text-[var(--color-foreground)]">
                  No critical alerts right now.
                </span>{" "}
                Active community reports are still listed below.
              </div>
            ) : null}

            {loading ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-5 text-[0.88rem] text-[var(--color-muted-foreground)]">
                Loading live alerts...
              </div>
            ) : error ? (
              <div className="rounded-[14px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-4 py-5 text-[0.88rem] text-[var(--color-danger-text)]">
                {error}
              </div>
            ) : showNoActiveReportsEmpty ? (
              <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[var(--color-panel)] px-4 py-4 text-center">
                <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-full bg-[color:color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-[var(--color-primary)]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="mt-3 text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                  No active flood reports right now
                </div>
                <p className="mt-1.5 text-[0.8rem] leading-5 text-[var(--color-muted-foreground)]">
                  There are no urgent community reports at the moment. You can still check the map, review safety reminders, or submit a report if you see flooding.
                </p>
                <div className="mt-3 flex flex-wrap justify-center gap-2">
                  <button
                    type="button"
                    onClick={onReportFlood}
                    className="h-8 rounded-[10px] bg-[var(--color-primary)] px-3 text-[0.74rem] font-semibold text-[var(--color-primary-foreground)]"
                  >
                    Report Flood Incident
                  </button>
                  <button
                    type="button"
                    onClick={onOpenFloodMap}
                    className="h-8 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.74rem] font-medium text-[var(--color-foreground)]"
                  >
                    View Flood Map
                  </button>
                </div>
              </div>
            ) : showNearbyLocationHint ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4">
                <div className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                  Nearby reports
                </div>
                <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                  {nearbyLocationMessage}
                </p>
                {canRequestNearbyLocation ? (
                  <button
                    type="button"
                    onClick={onRequestNearbyLocation}
                    className="mt-3 h-8 rounded-[10px] bg-[var(--color-primary)] px-3 text-[0.74rem] font-semibold text-[var(--color-primary-foreground)]"
                  >
                    Enable location
                  </button>
                ) : null}
              </div>
            ) : !hasAnyVisibleReports ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-5">
                <div className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                  No reports in this filter.
                </div>
                <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                  {activeReportCount > 0
                    ? "Try All, Recent, or another active report filter."
                    : "Check back later or submit a report if you see flooding."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {visibleGroups.map((group) => (
                  <section
                    key={group.id}
                    className="space-y-2 border-b border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] pb-3 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <h3 className="text-[0.88rem] font-semibold text-[var(--color-foreground)]">
                        {group.title}
                      </h3>
                      <p className="text-[0.74rem] leading-5 text-[var(--color-muted-foreground)]">
                        {group.description}
                      </p>
                    </div>
                    <div className="space-y-2">
                      {group.reports.map((report) => {
                        const freshnessBadge = getReportFreshnessBadge(report);
                        const statusPresentation = getStatusPresentation(report.status);
                        const confirmationLabel =
                          report.confirmations > 0
                            ? formatCountLabel(report.confirmations, "confirmation", "confirmations")
                            : "No confirmations yet";

                        return (
                          <article
                            key={report.id}
                            className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-panel)] px-3 py-3"
                          >
                            <div className="flex items-start gap-2">
                              <span
                                className={cn(
                                  "mt-0.5 inline-flex h-5 shrink-0 items-center rounded-full border px-1.5 text-[0.64rem] font-medium",
                                  severityBadgeClasses[report.severity],
                                )}
                              >
                                {severityLabels[report.severity]}
                              </span>
                              <button
                                type="button"
                                onClick={() => onViewOnMap(report.id)}
                                className="min-w-0 flex-1 text-left"
                              >
                                <div className="text-[0.9rem] font-semibold leading-5 text-[var(--color-foreground)]">
                                  {report.title}
                                </div>
                                <div className="mt-0.5 truncate text-[0.76rem] text-[var(--color-muted-foreground)]">
                                  {report.location}
                                </div>
                              </button>
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-1.5">
                              <span
                                className={cn(
                                  "inline-flex h-5 items-center rounded-full px-1.5 text-[0.64rem] font-medium",
                                  statusPresentation.wrapperClassName,
                                  statusPresentation.textClassName,
                                )}
                              >
                                {statusPresentation.label}
                              </span>
                              {freshnessBadge ? (
                                <span
                                  className={cn(
                                    "inline-flex h-5 items-center rounded-full px-1.5 text-[0.64rem] font-medium",
                                    freshnessBadge.tone === "success"
                                      ? "bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
                                      : freshnessBadge.tone === "warning"
                                        ? "bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                                        : freshnessBadge.tone === "muted"
                                          ? "bg-[var(--color-muted-surface)] text-[var(--color-muted-text)]"
                                          : "bg-[var(--color-info-surface)] text-[var(--color-info-text)]",
                                  )}
                                >
                                  {freshnessBadge.label}
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.73rem] text-[var(--color-muted-foreground)]">
                              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                                <Clock3 className="h-3.5 w-3.5" />
                                {getReportActivityLabel(report)}
                              </span>
                              <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                                <ThumbsUp className="h-3.5 w-3.5" />
                                {confirmationLabel}
                              </span>
                            </div>

                            <p className="mt-2 line-clamp-2 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
                              {report.description}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              <button
                                type="button"
                                onClick={() => onViewOnMap(report.id)}
                                className="inline-flex h-7 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[0.7rem] font-medium text-[var(--color-foreground)]"
                              >
                                <MapPinned className="h-3.5 w-3.5" />
                                <span>View on Map</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => onViewDetails(report.id)}
                                className="inline-flex h-7 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[0.7rem] font-medium text-[var(--color-foreground)]"
                              >
                                <Megaphone className="h-3.5 w-3.5" />
                                <span>Update</span>
                              </button>
                              <button
                                type="button"
                                onClick={onFindEvacuationCenters}
                                className="inline-flex h-7 items-center justify-center gap-1.5 rounded-[9px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 text-[0.7rem] font-medium text-[var(--color-foreground)]"
                              >
                                <Building2 className="h-3.5 w-3.5" />
                                <span>Centers</span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}

            <section className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_74%,transparent)] px-3 py-3">
              <div className="text-[0.82rem] font-semibold text-[var(--color-foreground)]">
                What you can do now
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {quickActions.map((action) => {
                  const Icon = action.icon;

                  return (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-1.5 text-left text-[0.7rem] font-medium leading-4 text-[var(--color-foreground)]"
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--color-primary)]" />
                      <span>{action.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_62%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_74%,transparent)] px-3 py-3">
              <div className="flex items-center gap-2 text-[0.82rem] font-semibold text-[var(--color-foreground)]">
                <ShieldCheck className="h-4 w-4 text-[var(--color-primary)]" />
                Safety Reminders
              </div>
              <ul className="mt-2 space-y-1.5 text-[0.74rem] leading-5 text-[var(--color-muted-foreground)]">
                {safetyReminders.map((reminder) => (
                  <li key={reminder} className="flex items-start gap-2">
                    <Route className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                    <span>{reminder}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>
      </div>
    </>
  );
}
