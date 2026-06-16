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
    <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-3">
      <div className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-1.5 text-[0.92rem] font-semibold text-[var(--color-foreground)]">
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
      <div className="fixed inset-0 z-[1210] flex items-center justify-center p-3 sm:p-4">
        <div className="flex max-h-[94vh] w-full max-w-[680px] flex-col overflow-hidden rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[0_24px_80px_rgba(15,23,42,0.26)]">
          <div className="relative aspect-[16/8.4] overflow-hidden bg-[var(--color-panel)]">
            {currentPhoto?.imageUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={currentPhoto.imageUrl}
                alt={currentPhoto.label}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[0.95rem] font-medium text-[var(--color-muted-foreground)]">
                No photo attached
              </div>
            )}

            <button
              type="button"
              aria-label="Close report details"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-slate-700/85 text-white"
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
                  className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  onClick={() =>
                    setPhotoIndex((current) => (current + 1) % photos.length)
                  }
                  className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-slate-500/75 text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.74rem] font-semibold",
                  statusPresentation.textClassName,
                  statusPresentation.wrapperClassName,
                )}
              >
                <span className={cn("h-2 w-2 rounded-full", statusPresentation.dotClassName)} />
                <span>{statusPresentation.label}</span>
              </span>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold",
                  severityBadgeClasses[report.severity],
                )}
              >
                {severityLabels[report.severity]}
              </span>
              <span className="inline-flex items-center rounded-full bg-[var(--color-panel)] px-2.5 py-1 text-[0.74rem] font-medium text-[var(--color-foreground)]">
                {report.sourceUnit}
              </span>
            </div>

            <div className="mt-3">
              <h2 className="text-[1.2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)] sm:text-[1.34rem]">
                {report.title}
              </h2>
              <div className="mt-2 flex items-start gap-2 text-[0.9rem] text-[var(--color-foreground)]">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
                <div className="min-w-0">
                  <div>{report.location}</div>
                  <div className="mt-0.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
                    {report.coordinatesLabel}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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

            <div className="mt-4 rounded-[14px] border border-[rgba(148,163,184,0.18)] bg-[rgba(148,163,184,0.06)] px-3.5 py-3">
              <div className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                Community signal
              </div>
              <p className="mt-1 text-[0.86rem] leading-6 text-[var(--color-foreground)]">
                {communitySignal}
              </p>
            </div>

            <div className="mt-4 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-3">
              <div className="flex items-center gap-2 text-[0.84rem] font-medium text-[var(--color-foreground)]">
                <Waves className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{report.category}</span>
              </div>
              {report.waterLevel ? (
                <div className="mt-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
                  Water level: <span className="font-medium text-[var(--color-foreground)]">{report.waterLevel}</span>
                </div>
              ) : null}
              {report.note ? (
                <div className="mt-2 text-[0.84rem] text-[var(--color-foreground)]">
                  {report.note}
                </div>
              ) : null}
            </div>

            <div className="mt-4">
              <h3 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
                Description
              </h3>
              <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
                {report.description}
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
              <div className="mt-4 rounded-[14px] border border-[rgba(148,163,184,0.24)] bg-[rgba(148,163,184,0.08)] px-3.5 py-3 text-[0.84rem] text-[var(--color-foreground)]">
                {report.resolvedAgo}
              </div>
            ) : null}

            <div className="mt-4 rounded-[14px] border border-[rgba(245,158,11,0.16)] bg-[rgba(245,158,11,0.06)] px-3.5 py-3">
              <div className="flex items-start gap-2">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
                <p className="text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                  Community reports are not official advisories. Follow LGU, PAGASA, and emergency response updates before traveling.
                </p>
              </div>
            </div>

            {updates.length > 0 ? (
              <div className="mt-4 border-t border-[var(--color-border)] pt-4">
                <div className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  Recent updates
                </div>
                <div className="mt-3 space-y-2">
                  {updates.map((update) => (
                    <div
                      key={update.id}
                      className="rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3.5 py-3"
                    >
                      <div className="text-[0.74rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                        {update.updateType}
                      </div>
                      <p className="mt-1 text-[0.86rem] text-[var(--color-foreground)]">
                        {update.message}
                      </p>
                      <div className="mt-1 text-[0.76rem] text-[var(--color-muted-foreground)]">
                        {formatRelativeTime(update.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => onConfirm(report.id)}
                disabled={confirmDisabled}
                className={cn(
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-[11px] px-4 text-[0.88rem] font-semibold",
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
                  "flex h-10 flex-1 items-center justify-center gap-2 rounded-[11px] border px-4 text-[0.88rem] font-medium",
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
                className="h-10 rounded-[11px] border border-[var(--color-border)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)]"
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
