"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPinned,
  X,
} from "lucide-react";

import { WeatherAlertIcon } from "@/components/weather-alert-icon";
import {
  alertSeverityBadgeClasses,
  alertSeverityIconClasses,
  getAlertRelativeUpdateLabel,
  getAlertSummary,
  sortAlertsByPriority,
} from "@/lib/alert-ui";
import type { FloodAlert } from "@/lib/types";
import { cn } from "@/lib/utils";

type WeatherAlertViewerProps = {
  open: boolean;
  alerts: FloodAlert[];
  initialAlertId?: string | null;
  canViewAlertOnMap?: (alert: FloodAlert) => boolean;
  onClose: () => void;
  onViewOnMap: (alert: FloodAlert) => void;
  onViewAllAlerts: () => void;
};

function getIssuingAgency(alert: FloodAlert) {
  return (
    alert.officialSourceName ||
    alert.officialReference.officialSourceName ||
    alert.officialReference.name ||
    "PAGASA"
  );
}

function getIssuedTime(alert: FloodAlert) {
  return (
    alert.officialIssuedAt ||
    alert.officialReference.officialIssuedAt ||
    alert.updatedAt ||
    "Time unavailable"
  );
}

function AlertMetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_72%,transparent)] px-3 py-2">
      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.05em] text-[var(--color-muted-foreground)]">
        {label}
      </div>
      <div className="mt-1 text-[0.82rem] font-medium text-[var(--color-foreground)]">
        {value}
      </div>
    </div>
  );
}

export function WeatherAlertViewer({
  open,
  alerts,
  initialAlertId = null,
  canViewAlertOnMap,
  onClose,
  onViewOnMap,
  onViewAllAlerts,
}: WeatherAlertViewerProps) {
  const orderedAlerts = useMemo(() => sortAlertsByPriority(alerts), [alerts]);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextIndex = initialAlertId
      ? orderedAlerts.findIndex((alert) => alert.id === initialAlertId)
      : 0;

    const frameId = window.requestAnimationFrame(() => {
      setActiveIndex(nextIndex >= 0 ? nextIndex : 0);
      closeButtonRef.current?.focus();
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [initialAlertId, open, orderedAlerts]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open || orderedAlerts.length === 0) {
    return null;
  }

  const activeAlert = orderedAlerts[Math.min(activeIndex, orderedAlerts.length - 1)];
  const hasMultipleAlerts = orderedAlerts.length > 1;
  const mapActionAvailable = canViewAlertOnMap?.(activeAlert) ?? true;

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-modal-backdrop)] backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[var(--layer-modal)] flex items-end justify-center p-0 md:items-center md:p-4">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="weather-alert-title"
          className="flex max-h-[88dvh] w-full max-w-[640px] flex-col overflow-hidden rounded-t-[20px] border border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] md:max-h-[90vh] md:rounded-[18px]"
        >
          <div className="shrink-0 border-b border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] px-4 pb-3 pt-3 md:px-5">
            <div className="flex justify-center md:hidden">
              <div className="h-1 w-10 rounded-full bg-[var(--color-border)]" />
            </div>
            <div className="mt-2 flex items-start justify-between gap-3 md:mt-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]",
                      alertSeverityIconClasses[activeAlert.severity],
                    )}
                  >
                    <WeatherAlertIcon alert={activeAlert} className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-flex rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold",
                          alertSeverityBadgeClasses[activeAlert.severity],
                        )}
                      >
                        {activeAlert.riskLevel}
                      </span>
                      {hasMultipleAlerts ? (
                        <span className="rounded-full bg-[var(--color-muted-surface)] px-2 py-0.5 text-[0.68rem] font-medium text-[var(--color-muted-text)]">
                          {activeIndex + 1} of {orderedAlerts.length}
                        </span>
                      ) : null}
                    </div>
                    <h2
                      id="weather-alert-title"
                      className="mt-1 text-[1rem] font-semibold leading-5 text-[var(--color-foreground)] md:text-[1.18rem] md:leading-6"
                    >
                      {activeAlert.title}
                    </h2>
                  </div>
                </div>
              </div>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close weather alert"
                onClick={onClose}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-5">
            {hasMultipleAlerts ? (
              <div className="mb-3 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) =>
                      current === 0 ? orderedAlerts.length - 1 : current - 1,
                    )
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[0.74rem] font-medium text-[var(--color-foreground)]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Previous</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setActiveIndex((current) => (current + 1) % orderedAlerts.length)
                  }
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] px-2.5 text-[0.74rem] font-medium text-[var(--color-foreground)]"
                >
                  <span>Next</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <AlertMetaRow label="Severity" value={activeAlert.riskLevel} />
              <AlertMetaRow label="Affected area" value={activeAlert.location} />
              <AlertMetaRow label="Issued" value={getIssuedTime(activeAlert)} />
              <AlertMetaRow label="Issuing agency" value={getIssuingAgency(activeAlert)} />
            </div>

            <section className="mt-4 rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_68%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_76%,transparent)] px-3.5 py-3">
              <div className="text-[0.76rem] font-semibold text-[var(--color-muted-foreground)]">
                Full advisory
              </div>
              <p className="mt-2 whitespace-pre-line text-[0.86rem] leading-6 text-[var(--color-foreground)]">
                {getAlertSummary(activeAlert)}
              </p>
              <p className="mt-3 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
                {activeAlert.disclaimer}
              </p>
            </section>

            <div className="mt-3 text-[0.76rem] text-[var(--color-muted-foreground)]">
              <span>{getAlertRelativeUpdateLabel(activeAlert)}</span>
              <span> · Last updated {activeAlert.updatedAt}</span>
            </div>
          </div>

          <div className="shrink-0 border-t border-[color:color-mix(in_srgb,var(--color-border)_66%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_96%,transparent)] px-4 py-3 md:px-5">
            <div className="grid gap-2 sm:grid-cols-3">
              <button
                type="button"
                onClick={() => onViewOnMap(activeAlert)}
                disabled={!mapActionAvailable}
                className={cn(
                  "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] px-3 text-[0.8rem] font-semibold",
                  mapActionAvailable
                    ? "floodwatch-primary-action"
                    : "cursor-not-allowed bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]",
                )}
              >
                <MapPinned className="h-4 w-4" />
                <span>View on Map</span>
              </button>
              <button
                type="button"
                onClick={onViewAllAlerts}
                className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.8rem] font-semibold text-[var(--color-foreground)]"
              >
                <ExternalLink className="h-4 w-4" />
                <span>View All Alerts</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="inline-flex min-h-10 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.8rem] font-semibold text-[var(--color-foreground)]"
              >
                Close
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
