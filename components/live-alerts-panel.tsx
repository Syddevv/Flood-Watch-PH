"use client";

import { useEffect, useMemo, useRef } from "react";
import { AlertTriangle, Clock3, Eye, MapPinned, ThumbsUp, X } from "lucide-react";

import { formatCountLabel } from "@/lib/reporting";
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

type LiveAlertsPanelProps = {
  open: boolean;
  loading?: boolean;
  error?: string | null;
  groups: LiveAlertGroup[];
  urgentCount: number;
  onClose: () => void;
  onViewOnMap: (reportId: string) => void;
  onViewDetails: (reportId: string) => void;
};

export function LiveAlertsPanel({
  open,
  loading = false,
  error = null,
  groups,
  urgentCount,
  onClose,
  onViewOnMap,
  onViewDetails,
}: LiveAlertsPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const summaryItems = useMemo(() => {
    return groups
      .filter((group) => group.reports.length > 0)
      .map((group) => `${group.reports.length} ${group.title.toLowerCase()}`);
  }, [groups]);

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
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[var(--layer-sheet)] flex justify-end md:inset-y-[calc(var(--header-height)+0.75rem)] md:right-4 md:left-auto">
        <section
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="live-alerts-title"
          className="pointer-events-auto flex max-h-[82vh] w-full max-w-[30rem] flex-col rounded-t-[20px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:h-full md:max-h-none md:rounded-[18px]"
        >
          <div className="border-b border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] px-4 pb-3 pt-3 md:px-5 md:pt-4">
            <div className="flex justify-center md:hidden">
              <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="mt-2 flex items-start justify-between gap-3 md:mt-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-[11px] bg-[color:color-mix(in_srgb,var(--color-danger)_14%,var(--color-surface))] text-[var(--color-danger)]">
                    <AlertTriangle className="h-4 w-4" />
                  </span>
                  <div>
                    <h2
                      id="live-alerts-title"
                      className="text-[1rem] font-semibold text-[var(--color-foreground)]"
                    >
                      Live Alerts
                    </h2>
                    <p className="text-[0.78rem] text-[var(--color-muted-foreground)]">
                      Urgent and recently updated flood reports.
                    </p>
                  </div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close live alerts"
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_78%,transparent)] px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.8rem] text-[var(--color-muted-foreground)]">
                <span className="font-semibold text-[var(--color-foreground)]">
                  <span className="font-mono tabular-nums">{urgentCount}</span>{" "}
                  {urgentCount === 1 ? "urgent alert" : "urgent alerts"}
                </span>
                {summaryItems.length > 0 ? (
                  <span className="font-mono tabular-nums">{summaryItems.join(" · ")}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
            {loading ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-5 text-[0.88rem] text-[var(--color-muted-foreground)]">
                Loading live alerts...
              </div>
            ) : error ? (
              <div className="rounded-[14px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-4 py-5 text-[0.88rem] text-[var(--color-danger-text)]">
                {error}
              </div>
            ) : groups.every((group) => group.reports.length === 0) ? (
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-5">
                <div className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                  No critical live alerts right now.
                </div>
                <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                  Check the map for community reports and local updates.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) =>
                  group.reports.length > 0 ? (
                    <section
                      key={group.id}
                      className="space-y-2 border-b border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] pb-4 last:border-b-0 last:pb-0"
                    >
                      <div>
                        <h3 className="text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                          {group.title}
                        </h3>
                        <p className="text-[0.76rem] leading-5 text-[var(--color-muted-foreground)]">
                          {group.description}
                        </p>
                      </div>
                      <div className="space-y-2">
                        {group.reports.map((report) => {
                          const freshnessBadge = getReportFreshnessBadge(report);
                          const confirmationLabel =
                            report.confirmations > 0
                              ? `${formatCountLabel(report.confirmations, "confirmed", "confirmed")}`
                              : "No confirmations yet";

                          return (
                            <article
                              key={report.id}
                              className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-panel)] px-3 py-3"
                            >
                              <button
                                type="button"
                                onClick={() => onViewOnMap(report.id)}
                                className="w-full text-left"
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="text-[0.92rem] font-semibold leading-6 text-[var(--color-foreground)]">
                                      {report.title}
                                    </div>
                                    <div className="truncate text-[0.78rem] text-[var(--color-muted-foreground)]">
                                      {report.location}
                                    </div>
                                  </div>
                                  {freshnessBadge ? (
                                    <span
                                      className={cn(
                                        "shrink-0 rounded-full px-2 py-1 text-[0.68rem] font-medium",
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
                              </button>

                              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.75rem] text-[var(--color-muted-foreground)]">
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono tabular-nums">
                                  <Clock3 className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                                  {getReportActivityLabel(report)}
                                </span>
                                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono tabular-nums">
                                  <ThumbsUp className="h-3.5 w-3.5 text-[var(--color-muted-foreground)]" />
                                  {confirmationLabel}
                                </span>
                              </div>

                              <div className="mt-3 flex flex-wrap items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onViewOnMap(report.id)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.76rem] font-medium text-[var(--color-foreground)]"
                                >
                                  <MapPinned className="h-3.5 w-3.5" />
                                  <span>View on map</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onViewDetails(report.id)}
                                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[0.76rem] font-medium text-[var(--color-muted-foreground)]"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View details</span>
                                </button>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ) : null,
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
