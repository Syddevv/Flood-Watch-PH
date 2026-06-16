"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  MapPin,
  ShieldAlert,
  ThumbsUp,
  Waves,
  X,
} from "lucide-react";

import { formatCountLabel, formatRelativeTime } from "@/lib/reporting";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";

import type { ReportUpdateItem } from "@/lib/report-types";
import {
  getReportCommunitySignal,
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

function SummaryMetric({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] py-2 last:border-b-0 sm:block sm:rounded-[14px] sm:border sm:bg-[var(--color-panel)] sm:px-3.5 sm:py-3">
      <div className="flex items-center gap-1.5 text-[0.66rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] sm:gap-2 sm:text-[0.72rem]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-right text-[0.82rem] font-semibold text-[var(--color-foreground)] sm:mt-1.5 sm:text-left sm:text-[0.92rem]">
        {value}
      </div>
    </div>
  );
}

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
  const communitySignal = getReportCommunitySignal(report);

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[1200] bg-slate-950/42 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[1210] flex items-center justify-center p-2.5 sm:p-4">
        <div className="flex max-h-[92dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.26)] md:max-h-[94vh] md:rounded-[18px]">
          <div className="relative h-[160px] overflow-hidden bg-[var(--color-panel)] md:aspect-[16/8.4] md:h-auto">
            {currentPhoto?.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentPhoto.imageUrl}
                alt={currentPhoto.label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[0.88rem] font-medium text-[var(--color-muted-foreground)] md:text-[0.95rem]">
                No photo attached
              </div>
            )}

            <button
              type="button"
              aria-label="Close report details"
              onClick={() => onOpenChange(false)}
              className="absolute right-2.5 top-2.5 flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/85 text-white md:right-3 md:top-3 md:h-9 md:w-9"
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
                  className="absolute left-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white md:left-3 md:h-9 md:w-9"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() =>
                    setPhotoIndex((current) => (current + 1) % photos.length)
                  }
                  className="absolute right-2.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white md:right-3 md:h-9 md:w-9"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 md:px-5 md:py-4">
            <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.75 text-[0.66rem] font-semibold md:px-2.5 md:py-1 md:text-[0.74rem]",
                  statusPresentation.textClassName,
                  statusPresentation.wrapperClassName,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", statusPresentation.dotClassName)} />
                <span>{statusPresentation.label}</span>
              </span>
              <span
                className={cn(
                  "rounded-full border px-2 py-0.75 text-[0.66rem] font-semibold md:px-2.5 md:py-1 md:text-[0.72rem]",
                  severityBadgeClasses[report.severity],
                )}
              >
                {severityLabels[report.severity]}
              </span>
              <span className="inline-flex items-center rounded-full bg-[var(--color-panel)] px-2 py-0.75 text-[0.66rem] font-medium text-[var(--color-foreground)] md:px-2.5 md:py-1 md:text-[0.74rem]">
                {report.sourceUnit}
              </span>
            </div>

            <div className="mt-2.5 md:mt-3">
              <h2 className="text-[1rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)] md:text-[1.34rem]">
                {report.title}
              </h2>
              <div className="mt-1 flex items-start gap-2 text-[0.82rem] text-[var(--color-foreground)] md:mt-2 md:text-[0.9rem]">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-primary)] md:h-4 md:w-4" />
                <div className="min-w-0">
                  <div>{report.location}</div>
                  <div className="mt-0.5 text-[0.72rem] text-[var(--color-muted-foreground)] md:text-[0.78rem]">
                    {report.coordinatesLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2.5 space-y-0 md:mt-4 md:grid md:grid-cols-2 md:gap-2.5 md:space-y-0">
              <SummaryMetric
                icon={<Clock3 className="h-3.5 w-3.5" />}
                label="Reported"
                value={report.reportedAgo}
              />
              <SummaryMetric
                icon={<Waves className="h-3.5 w-3.5" />}
                label="Last activity"
                value={report.lastActivityAgo ?? report.reportedAgo}
              />
              <SummaryMetric
                icon={<ThumbsUp className="h-3.5 w-3.5" />}
                label="Community confirmed"
                value={formatCountLabel(report.confirmations)}
              />
              <SummaryMetric
                icon={<Check className="h-3.5 w-3.5" />}
                label="Marked receded"
                value={formatCountLabel(report.resolvedConfirmations)}
              />
            </div>

            <div className="mt-3 rounded-[12px] bg-[rgba(148,163,184,0.06)] px-3 py-2 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)] md:mt-4 md:rounded-[14px] md:border md:border-[rgba(148,163,184,0.18)] md:px-3.5 md:py-3">
              <div className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] md:text-[0.74rem]">
                Community signal
              </div>
              <p className="mt-1 text-[0.78rem] leading-5 text-[var(--color-foreground)] md:text-[0.86rem] md:leading-6">
                {communitySignal}
              </p>
            </div>

            <div className="mt-3 md:mt-4 md:rounded-[14px] md:border md:border-[var(--color-border)] md:bg-[var(--color-surface)] md:px-3.5 md:py-3">
              <div className="flex items-center gap-2 text-[0.78rem] font-medium text-[var(--color-foreground)] md:text-[0.84rem]">
                <Waves className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{report.category}</span>
              </div>
              {report.waterLevel ? (
                <div className="mt-1 text-[0.76rem] text-[var(--color-muted-foreground)] md:mt-2 md:text-[0.84rem]">
                  Water level: <span className="font-medium text-[var(--color-foreground)]">{report.waterLevel}</span>
                </div>
              ) : null}
              {report.note ? (
                <div className="mt-1 text-[0.76rem] text-[var(--color-foreground)] md:mt-2 md:text-[0.84rem]">
                  {report.note}
                </div>
              ) : null}
            </div>

            <div className="mt-2.5 md:mt-4">
              <h3 className="text-[0.84rem] font-semibold text-[var(--color-foreground)] md:text-[0.95rem]">
                Description
              </h3>
              <p className="mt-1 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)] md:mt-2 md:text-[0.88rem] md:leading-6">
                {report.description}
              </p>
            </div>

            <div className="mt-3 text-[0.76rem] text-[var(--color-muted-foreground)] md:hidden">
              <span className="font-semibold text-[var(--color-foreground)]">{report.reporter}</span>
              <span> · </span>
              <span>{report.sourceUnit}</span>
            </div>
            <div className="mt-4 hidden grid-cols-1 gap-2.5 md:grid md:grid-cols-2">
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  Reporter
                </div>
                <div className="mt-1 text-[0.86rem] font-medium text-[var(--color-foreground)]">
                  {report.reporter}
                </div>
              </div>
              <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-3">
                <div className="text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  Source
                </div>
                <div className="mt-1 text-[0.86rem] font-medium text-[var(--color-foreground)]">
                  {report.sourceUnit}
                </div>
              </div>
            </div>

            {report.resolvedAgo ? (
              <div className="mt-3 rounded-[12px] border border-[rgba(148,163,184,0.24)] bg-[rgba(148,163,184,0.08)] px-3 py-2 text-[0.76rem] text-[var(--color-foreground)] md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3 md:text-[0.84rem]">
                {report.resolvedAgo}
              </div>
            ) : null}

            <div className="mt-3 rounded-[12px] border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.06)] px-3 py-2 md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                <p className="text-[0.74rem] leading-5 text-[var(--color-muted-foreground)] md:text-[0.82rem] md:leading-6">
                  Community reports are not official advisories. Follow LGU, PAGASA, and emergency response updates before traveling.
                </p>
              </div>
            </div>

            {updates.length > 0 ? (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3 md:mt-4 md:pt-4">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] md:text-[0.74rem]">
                  Recent updates
                </div>
                <div className="mt-2 space-y-2 md:mt-3">
                  {updates.map((update) => (
                    <div
                      key={update.id}
                      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2.5 md:px-3.5 md:py-3"
                    >
                      <div className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] md:text-[0.74rem]">
                        {update.updateType}
                      </div>
                      <p className="mt-1 text-[0.78rem] text-[var(--color-foreground)] md:text-[0.86rem]">
                        {update.message}
                      </p>
                      <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)] md:text-[0.76rem]">
                        {formatRelativeTime(update.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 md:px-5 md:py-3">
            <div className="grid grid-cols-2 gap-2 md:flex md:flex-row">
              <button
                type="button"
                onClick={() => onConfirm(report.id)}
                disabled={confirmDisabled}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[0.8rem] font-semibold md:h-10 md:gap-2 md:rounded-[11px] md:px-4 md:text-[0.88rem]",
                  confirmDisabled
                    ? "bg-[rgba(148,163,184,0.16)] text-slate-500"
                    : "bg-[var(--color-primary)] text-white",
                )}
              >
                <ThumbsUp className="h-4 w-4" />
                <span>{hasConfirmed ? "Confirmed" : "Confirm report"}</span>
              </button>
              <button
                type="button"
                onClick={() => onResolve(report.id)}
                disabled={resolveDisabled}
                className={cn(
                  "flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[0.8rem] font-medium md:h-10 md:gap-2 md:rounded-[11px] md:px-4 md:text-[0.88rem]",
                  resolveDisabled
                    ? "border-[rgba(148,163,184,0.2)] bg-[rgba(148,163,184,0.12)] text-slate-500"
                    : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
                )}
              >
                <Check className="h-4 w-4" />
                <span>{hasResolved ? "Reported receded" : "Report receded"}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="hidden h-10 rounded-[11px] border border-[var(--color-border)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)] md:block"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
