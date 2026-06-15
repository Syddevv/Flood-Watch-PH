"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  ThumbsUp,
  Waves,
  X,
} from "lucide-react";

import { formatCountLabel, formatRelativeTime } from "@/lib/reporting";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";

import type { ReportUpdateItem } from "@/lib/report-types";
import {
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";

type IncidentReportModalProps = {
  report: IncidentReport | null;
  updates: ReportUpdateItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reportId: string) => void;
  onResolve: (reportId: string) => void;
  hasConfirmed: boolean;
  hasResolved: boolean;
  actionLoading: boolean;
};

export function IncidentReportModal({
  report,
  updates,
  open,
  onOpenChange,
  onConfirm,
  onResolve,
  hasConfirmed,
  hasResolved,
  actionLoading,
}: IncidentReportModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!open || !report) {
    return null;
  }

  const photos = report.photos;
  const currentPhoto = photos[photoIndex] ?? photos[0] ?? null;
  const statusPresentation = getStatusPresentation(report.status);
  const isResolved = report.status === "Resolved";
  const confirmDisabled = actionLoading || hasConfirmed || isResolved;
  const resolveDisabled = actionLoading || hasResolved || isResolved;

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1200] bg-slate-950/42 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[1210] flex items-center justify-center p-4">
        <div className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.26)]">
          <div className="relative aspect-[16/9] overflow-hidden bg-[var(--color-panel)]">
            {currentPhoto?.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentPhoto.imageUrl}
                alt={currentPhoto.label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[1.05rem] font-medium text-[var(--color-muted-foreground)]">
                No photo attached
              </div>
            )}

            <button
              type="button"
              aria-label="Close report details"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full bg-slate-700/85 text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {photos.length > 1 ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  onClick={() =>
                    setPhotoIndex((current) =>
                      current === 0 ? photos.length - 1 : current - 1,
                    )
                  }
                  className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() =>
                    setPhotoIndex((current) => (current + 1) % photos.length)
                  }
                  className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                    {report.title}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold",
                      severityBadgeClasses[report.severity],
                    )}
                  >
                    {severityLabels[report.severity]}
                  </span>
                </div>
                <div className="mt-2 text-[1rem] font-medium text-[var(--color-foreground)]">
                  {report.location}
                </div>
                <div className="mt-1 flex items-center gap-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                  <MapPin className="h-4 w-4" />
                  <span>{report.coordinatesLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-2 rounded-[11px] px-3 py-2 text-[0.84rem] font-medium",
                  statusPresentation.textClassName,
                  statusPresentation.wrapperClassName,
                )}
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", statusPresentation.dotClassName)} />
                <span>{statusPresentation.label}</span>
              </span>
              <span className="inline-flex items-center rounded-[11px] bg-[var(--color-panel)] px-3 py-2 text-[0.84rem] font-medium text-[var(--color-foreground)]">
                {report.sourceUnit}
              </span>
            </div>

            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                <Waves className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{report.category}</span>
              </div>
              {report.waterLevel ? (
                <div className="mt-3 text-[1rem] font-medium text-[var(--color-muted-foreground)]">
                  Water Level:{" "}
                  <span className="text-[var(--color-foreground)]">
                    {report.waterLevel}
                  </span>
                </div>
              ) : null}
              {report.note ? (
                <div className="mt-3 text-[1rem] font-medium text-[var(--color-foreground)]">
                  {report.note}
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <h3 className="text-[1.02rem] font-semibold text-[var(--color-foreground)]">
                Description
              </h3>
              <p className="mt-2 text-[0.95rem] leading-8 text-[var(--color-muted-foreground)]">
                {report.description}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-4">
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  REPORTED
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <Clock3 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{report.reportedAgo}</span>
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  LAST ACTIVITY
                </div>
                <div className="mt-1.5 text-[0.95rem] text-[var(--color-foreground)]">
                  {report.lastActivityAgo ?? report.reportedAgo}
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  REPORTER
                </div>
                <div className="mt-1.5 text-[0.95rem] text-[var(--color-foreground)]">
                  {report.reporter}
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  CONFIRMATIONS
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <ThumbsUp className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{formatCountLabel(report.confirmations)}</span>
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  RECEDED REPORTS
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <Check className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{formatCountLabel(report.resolvedConfirmations)}</span>
                </div>
              </div>
            </div>

            <div className="mt-5 space-y-2 rounded-[12px] border border-[rgba(148,163,184,0.18)] bg-[rgba(148,163,184,0.06)] px-4 py-3 text-[0.84rem] text-[var(--color-muted-foreground)]">
              <p>This report may be hidden after it is resolved or inactive for some time.</p>
              <p>Water receded reports are community-submitted and may need verification.</p>
            </div>

            {report.resolvedAgo ? (
              <div className="mt-5 rounded-[12px] border border-[rgba(148,163,184,0.28)] bg-[rgba(148,163,184,0.08)] px-4 py-3 text-[0.9rem] text-slate-600">
                {report.resolvedAgo}
              </div>
            ) : null}

            {updates.length > 0 ? (
              <div className="mt-5 border-t border-[var(--color-border)] pt-4">
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  RECENT UPDATES
                </div>
                <div className="mt-3 space-y-2.5">
                  {updates.map((update) => (
                    <div
                      key={update.id}
                      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-3"
                    >
                      <div className="text-[0.78rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                        {update.updateType}
                      </div>
                      <p className="mt-1 text-[0.9rem] text-[var(--color-foreground)]">
                        {update.message}
                      </p>
                      <div className="mt-1 text-[0.78rem] text-[var(--color-muted-foreground)]">
                        {formatRelativeTime(update.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4">
            <button
              type="button"
              onClick={() => onConfirm(report.id)}
              disabled={confirmDisabled}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] px-4 text-[0.95rem] font-semibold",
                confirmDisabled
                  ? "bg-[rgba(148,163,184,0.16)] text-slate-500"
                  : "bg-[var(--color-primary)] text-white",
              )}
              >
                <ThumbsUp className="h-4 w-4" />
                <span>{hasConfirmed ? "Confirmed" : "Confirm Report"}</span>
              </button>
            <button
              type="button"
              onClick={() => onResolve(report.id)}
              disabled={resolveDisabled}
              className={cn(
                "flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] border px-4 text-[0.95rem] font-medium",
                resolveDisabled
                  ? "border-[rgba(148,163,184,0.2)] bg-[rgba(148,163,184,0.12)] text-slate-500"
                  : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
              )}
              >
                <Check className="h-4 w-4" />
                <span>{hasResolved ? "Reported Receded" : "Report Water Receded"}</span>
              </button>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="h-11 rounded-[12px] border border-[var(--color-border)] px-5 text-[0.95rem] font-medium text-[var(--color-foreground)]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
