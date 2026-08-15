"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  LoaderCircle,
  X,
} from "lucide-react";

import { IncidentReportModal } from "@/components/incident-report-modal";
import { useReportSessionReady } from "@/components/report-session-provider";
import {
  buildReportDirectionsUrl,
  buildReportEvacuationCentersHref,
  buildReportUpdateHref,
  REPORT_ACTION_MESSAGES,
  type ReportActionLoadingState,
  type ReportActionType,
} from "@/lib/report-actions";
import {
  buildStoredActionKey,
  mapReportToIncident,
} from "@/lib/report-ui";
import { copyPublicReportUrl } from "@/lib/report-share";
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
  const reportSessionReady = useReportSessionReady();
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
    if (!reportSessionReady) {
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();

    async function loadReport() {
      setLoading(true);
      setNotFound(false);

      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          cache: "no-store",
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
  }, [reportId, reportSessionReady]);

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

  function leaveSharedReportPage() {
    if (
      typeof window !== "undefined" &&
      document.referrer.startsWith(window.location.origin) &&
      window.history.length > 1
    ) {
      router.back();
      return;
    }

    router.push("/flood-map");
  }

  return (
    <main className="min-h-dvh bg-[var(--color-background)] text-[var(--color-foreground)]">
      {loading || notFound || !report ? (
        <div className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col items-center justify-center px-4 py-5 md:px-6 md:py-8">
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
          ) : (
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
                onClick={() => router.push("/flood-map")}
                className="mt-5 inline-flex h-10 items-center justify-center rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.88rem] font-semibold text-[var(--color-primary-foreground)]"
              >
                Open flood map
              </button>
            </div>
          )}
        </div>
      ) : null}

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
            if (open) {
              setModalOpen(true);
              return;
            }

            leaveSharedReportPage();
          }}
        />
      ) : null}

      {toast ? (
        <ReportToast toast={toast} onDismiss={() => setToast(null)} />
      ) : null}
    </main>
  );
}
