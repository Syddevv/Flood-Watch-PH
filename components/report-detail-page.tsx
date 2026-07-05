"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Clock3,
  LoaderCircle,
  MapPin,
  Share2,
  X,
} from "lucide-react";

import { IncidentReportModal } from "@/components/incident-report-modal";
import {
  buildReportDirectionsUrl,
  buildReportEvacuationCentersHref,
  buildReportUpdateHref,
  REPORT_ACTION_MESSAGES,
  type ReportActionLoadingState,
  type ReportActionType,
} from "@/lib/report-actions";
import { createReportActionHeaders } from "@/lib/report-session";
import {
  buildStoredActionKey,
  mapReportToIncident,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  getReportActivityLabel,
  getReportFreshnessBadge,
} from "@/lib/report-trust";
import { buildPublicReportUrl, copyPublicReportUrl } from "@/lib/report-share";
import type {
  ReportDetailResponse,
  ReportRecord,
  ReportUpdateItem,
} from "@/lib/report-types";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReportDetailPageProps = {
  reportId: string;
};

type ToastState = {
  message: string;
  tone: "success" | "error";
} | null;

function ReportToast({
  toast,
  onDismiss,
}: {
  toast: Exclude<ToastState, null>;
  onDismiss: () => void;
}) {
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[var(--layer-toast)] flex justify-center md:justify-end">
      <div
        className={cn(
          "floodwatch-toast pointer-events-auto w-full max-w-[420px] px-4 py-3 text-[0.92rem]",
          toast.tone === "success"
            ? "floodwatch-toast--success"
            : "floodwatch-toast--error",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>{toast.message}</div>
          <button
            type="button"
            aria-label="Dismiss notification"
            onClick={onDismiss}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-current opacity-75 transition hover:bg-black/10 hover:opacity-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function ReportDetailPage({ reportId }: ReportDetailPageProps) {
  const router = useRouter();
  const [report, setReport] = useState<IncidentReport | null>(null);
  const [updates, setUpdates] = useState<ReportUpdateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [modalOpen, setModalOpen] = useState(true);
  const [actionLoading, setActionLoading] =
    useState<ReportActionLoadingState>(null);
  const [hasConfirmed, setHasConfirmed] = useState(false);
  const [hasResolved, setHasResolved] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const publicReportUrl = useMemo(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return buildPublicReportUrl({ id: reportId });
  }, [reportId]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    async function loadReport() {
      setLoading(true);
      setNotFound(false);

      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          cache: "no-store",
          headers: createReportActionHeaders(),
          signal: abortController.signal,
        });
        const payload = (await response.json()) as
          | ReportDetailResponse
          | { error: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error(
            response.status === 404
              ? "Report not found."
              : "error" in payload
                ? payload.error
                : "Unable to load report details.",
          );
        }

        if (!isMounted) {
          return;
        }

        const nextReport = mapReportToIncident(payload.data);
        setReport(nextReport);
        setUpdates(payload.data.updates);

        if (typeof window !== "undefined") {
          setHasConfirmed(
            localStorage.getItem(buildStoredActionKey("confirmed", nextReport.id)) === "true",
          );
          setHasResolved(
            localStorage.getItem(buildStoredActionKey("resolved", nextReport.id)) === "true",
          );
        }
      } catch (error) {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load public report detail.", error);
        setReport(null);
        setUpdates([]);
        setNotFound(true);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadReport();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [reportId]);

  function applyReportDetailPayload(payload: ReportDetailResponse) {
    setReport(mapReportToIncident(payload.data));
    setUpdates(payload.data.updates);
  }

  function applyUpdatedReport(
    reportIdToUpdate: string,
    payload: { data?: ReportRecord; error?: string },
    actionType: ReportActionType,
  ) {
    if (!payload.data) {
      throw new Error(payload.error ?? REPORT_ACTION_MESSAGES.error);
    }

    const nextReport = mapReportToIncident(payload.data);
    setReport(nextReport);

    if (typeof window !== "undefined") {
      localStorage.setItem(buildStoredActionKey(actionType, reportIdToUpdate), "true");
    }

    if (actionType === "confirmed") {
      setHasConfirmed(true);
    } else {
      setHasResolved(true);
    }
  }

  async function handleConfirmReport(nextReportId: string) {
    if (hasConfirmed) {
      return;
    }

    setActionLoading({ reportId: nextReportId, type: "confirmed" });

    try {
      const response = await fetch(`/api/reports/${nextReportId}/confirm`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as {
        data?: ReportRecord;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? REPORT_ACTION_MESSAGES.error);
      }

      applyUpdatedReport(nextReportId, payload, "confirmed");
      setToast({
        tone: "success",
        message: REPORT_ACTION_MESSAGES.confirmedSuccess,
      });
    } catch (error) {
      console.error("Failed to confirm public report.", error);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("confirmed", nextReportId), "true");
        }
        setHasConfirmed(true);
      }

      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message === "This report has already been updated from this browser."
              ? REPORT_ACTION_MESSAGES.duplicate
              : error.message
            : REPORT_ACTION_MESSAGES.error,
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolveReport(nextReportId: string) {
    if (hasResolved) {
      return;
    }

    setActionLoading({ reportId: nextReportId, type: "resolved" });

    try {
      const response = await fetch(`/api/reports/${nextReportId}/resolve`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as {
        data?: ReportRecord;
        error?: string;
      };

      if (!response.ok) {
        throw new Error(payload.error ?? REPORT_ACTION_MESSAGES.error);
      }

      applyUpdatedReport(nextReportId, payload, "resolved");
      setToast({
        tone: "success",
        message: REPORT_ACTION_MESSAGES.resolvedSuccess,
      });
    } catch (error) {
      console.error("Failed to mark public report as receded.", error);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("resolved", nextReportId), "true");
        }
        setHasResolved(true);
      }

      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message === "This report has already been updated from this browser."
              ? REPORT_ACTION_MESSAGES.duplicate
              : error.message
            : REPORT_ACTION_MESSAGES.error,
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleEditReport(
    selectedReport: IncidentReport,
    requestBody: FormData,
  ) {
    const response = await fetch(`/api/reports/${selectedReport.id}`, {
      method: "PATCH",
      headers: createReportActionHeaders(),
      body: requestBody,
    });
    const payload = (await response.json()) as ReportDetailResponse | { error?: string };

    if (!response.ok || !("data" in payload)) {
      const errorMessage =
        response.status === 403
          ? "Only the original uploader can edit this report."
          : "error" in payload && payload.error
            ? payload.error
            : "Unable to update this report.";
      setToast({ tone: "error", message: errorMessage });
      throw new Error(errorMessage);
    }

    applyReportDetailPayload(payload);
    setToast({ tone: "success", message: "Report updated successfully." });
  }

  async function handleSubmitReportUpdate(
    selectedReport: IncidentReport,
    requestBody: FormData,
  ) {
    const response = await fetch(`/api/reports/${selectedReport.id}/updates`, {
      method: "POST",
      headers: createReportActionHeaders(),
      body: requestBody,
    });
    const payload = (await response.json()) as ReportDetailResponse | { error?: string };

    if (!response.ok || !("data" in payload)) {
      const errorMessage =
        response.status === 403
          ? "Only the original uploader can edit this report."
          : "error" in payload && payload.error
            ? payload.error
            : "Unable to submit this update.";
      setToast({ tone: "error", message: errorMessage });
      throw new Error(errorMessage);
    }

    applyReportDetailPayload(payload);
    setToast({ tone: "success", message: "Report updated successfully." });
  }

  async function handleShareReport(selectedReport: IncidentReport) {
    const copied = await copyPublicReportUrl(selectedReport);

    setToast({
      tone: copied ? "success" : "error",
      message: copied ? "Report link copied." : "Unable to copy link.",
    });
  }

  function handleGetDirections(selectedReport: IncidentReport) {
    const directionsUrl = buildReportDirectionsUrl(selectedReport);

    if (directionsUrl) {
      window.open(directionsUrl, "_blank", "noopener,noreferrer");
    }
  }

  function handleFindEvacuationCenters(selectedReport: IncidentReport) {
    const href = buildReportEvacuationCentersHref(selectedReport);

    if (href) {
      router.push(href);
    }
  }

  const freshnessBadge = report ? getReportFreshnessBadge(report) : null;

  return (
    <main className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-5 md:px-6 md:py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => router.push("/incident-reports")}
            className="inline-flex h-10 items-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.86rem] font-medium text-[var(--color-foreground)]"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Reports</span>
          </button>
          {report && publicReportUrl ? (
            <button
              type="button"
              onClick={() => void handleShareReport(report)}
              className="inline-flex h-10 items-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-3 text-[0.86rem] font-semibold text-[var(--color-primary-foreground)]"
            >
              <Share2 className="h-4 w-4" />
              <span>Share</span>
            </button>
          ) : null}
        </div>

        <section className="mt-5 flex flex-1 items-center justify-center">
          {loading ? (
            <div className="flex w-full max-w-md flex-col items-center rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center shadow-[var(--shadow-soft)]">
              <LoaderCircle className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
              <h1 className="mt-4 text-[1.1rem] font-semibold text-[var(--color-foreground)]">
                Loading report
              </h1>
              <p className="mt-2 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
                Checking the latest public report details.
              </p>
            </div>
          ) : notFound || !report ? (
            <div className="w-full max-w-lg rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-7 text-center shadow-[var(--shadow-soft)]">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h1 className="mt-4 text-[1.18rem] font-semibold text-[var(--color-foreground)]">
                Report not found
              </h1>
              <p className="mt-2 text-[0.9rem] leading-6 text-[var(--color-muted-foreground)]">
                This report may have been removed, archived, or the link may be invalid.
              </p>
              <button
                type="button"
                onClick={() => router.push("/incident-reports")}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-[var(--color-primary-foreground)]"
              >
                Back to reports
              </button>
            </div>
          ) : (
            <article className="w-full rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] md:p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold",
                    severityBadgeClasses[report.severity],
                  )}
                >
                  {severityLabels[report.severity]}
                </span>
                {freshnessBadge ? (
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[0.72rem] font-medium",
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
              <h1 className="mt-3 text-[1.35rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)] md:text-[1.75rem]">
                {report.title}
              </h1>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span className="min-w-0">{report.location}</span>
                </span>
                <span className="inline-flex items-center gap-1.5 font-mono tabular-nums">
                  <Clock3 className="h-4 w-4 shrink-0" />
                  {getReportActivityLabel(report)}
                </span>
              </div>
              <p className="mt-4 max-w-3xl text-[0.94rem] leading-7 text-[var(--color-muted-foreground)]">
                {report.description}
              </p>
            </article>
          )}
        </section>
      </div>

      {report ? (
        <IncidentReportModal
          key={report.id}
          report={report}
          updates={updates}
          open={modalOpen}
          actionLoading={actionLoading}
          hasConfirmed={hasConfirmed}
          hasResolved={hasResolved}
          onConfirm={handleConfirmReport}
          onResolve={handleResolveReport}
          onEditReport={handleEditReport}
          onSubmitReportUpdate={handleSubmitReportUpdate}
          onReportUpdate={(selectedReport) => router.push(buildReportUpdateHref(selectedReport))}
          onShareReport={handleShareReport}
          onGetDirections={handleGetDirections}
          onFindEvacuationCenters={handleFindEvacuationCenters}
          onOpenChange={(open) => {
            setModalOpen(open);
            if (!open) {
              router.push("/incident-reports");
            }
          }}
        />
      ) : null}

      {toast ? (
        <ReportToast toast={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </main>
  );
}
