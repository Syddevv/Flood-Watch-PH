"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import {
  AlertTriangle,
  Check,
  Clock3,
  Eye,
  Flame,
  ImageUp,
  LoaderCircle,
  Map as MapIcon,
  MapPin,
  Phone,
  Send,
  ThumbsUp,
  Waves,
} from "lucide-react";

import {
  COMMUNITY_ACTIVITY_STATS,
  INCIDENT_CATEGORY_OPTIONS,
  REPORT_SEVERITIES,
  WATER_DEPTH_OPTIONS,
} from "@/lib/constants";
import {
  getReportImageAcceptValue,
  validateReportImageFile,
} from "@/lib/report-image-validation";
import {
  deriveReportLifecycleStatus,
  isActiveLifecycleStatus,
  isRecededLifecycleStatus,
} from "@/lib/report-lifecycle";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IncidentReportModal } from "@/components/incident-report-modal";
import { IncidentLocationPicker } from "@/components/incident-location-picker";
import type {
  ReportDetailResponse,
  NearbyReportRecord,
  NearbyReportsResponse,
  ReportUpdateItem,
  ReportRecord,
  ReportsResponse,
} from "@/lib/report-types";
import {
  buildStoredActionKey,
  getStatusPresentation,
  mapReportToIncident,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  compareReportsByPriority,
  getReportActivityLabel,
  getReportFreshnessBadge,
} from "@/lib/report-trust";
import {
  createReportActionHeaders,
  REPORT_ACTION_UNDO_WINDOW_MS,
} from "@/lib/report-session";
import { fetchWeatherLocation } from "@/lib/weather-client";

type FormState = {
  locationName: string;
  latitude: string;
  longitude: string;
  category: string;
  severity: string;
  waterDepth: string;
  description: string;
  reportedByName: string;
  contactNumber: string;
  submitAnonymously: boolean;
  photos: File[];
};

type ToastState = {
  message: string;
  tone: "success" | "error";
  actionType?: "confirmed" | "resolved";
  reportId?: string;
  expiresAt?: number;
  pending?: boolean;
} | null;

type PendingNearbyDuplicateState = {
  nearbyReports: NearbyReportRecord[];
  requestBody: FormData;
  photoAttached: boolean;
} | null;

const emptyFormState: FormState = {
  locationName: "",
  latitude: "",
  longitude: "",
  category: INCIDENT_CATEGORY_OPTIONS[0],
  severity: REPORT_SEVERITIES[1],
  waterDepth: WATER_DEPTH_OPTIONS[4],
  description: "",
  reportedByName: "",
  contactNumber: "",
  submitAnonymously: false,
  photos: [],
};

const reportImageAcceptValue = getReportImageAcceptValue();
const emptySubscribe = () => () => {};

function getTodaySnapshot() {
  return new Date().toDateString();
}

function UndoToast({
  toast,
  onUndo,
}: {
  toast: Exclude<ToastState, null>;
  onUndo: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!toast.expiresAt) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [toast.expiresAt]);

  const timeRemainingMs = toast.expiresAt
    ? Math.max(0, toast.expiresAt - now)
    : 0;
  const undoAvailable =
    Boolean(toast.actionType && toast.reportId && toast.expiresAt) &&
    timeRemainingMs > 0;
  const countdownSeconds = Math.ceil(timeRemainingMs / 1000);

  return (
    <div className="pointer-events-none fixed inset-x-4 top-[calc(var(--header-height)+1rem)] z-[var(--layer-toast)] flex justify-center md:left-[calc(var(--sidebar-width)+2rem)] md:right-6 md:justify-end">
      <div
        className={cn(
          "floodwatch-toast pointer-events-auto w-full max-w-[560px] px-4 py-3 text-[0.92rem]",
          toast.tone === "success"
            ? "floodwatch-toast--success"
            : "floodwatch-toast--error",
        )}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>{toast.message}</div>
          {undoAvailable ? (
            <div className="flex items-center gap-3">
              <div className="text-[0.78rem] font-medium opacity-75">
                {countdownSeconds}s
              </div>
              <button
                type="button"
                onClick={onUndo}
                disabled={toast.pending}
                className={cn(
                  "floodwatch-toast-action",
                  toast.tone === "success"
                    ? "floodwatch-toast-action--success"
                    : "floodwatch-toast-action--error",
                  toast.pending && "cursor-not-allowed opacity-60",
                )}
              >
                {toast.pending ? "Undoing..." : "Undo"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function applyOptimisticReportAction(
  report: IncidentReport,
  actionType: "confirmed" | "resolved",
): IncidentReport {
  const nextConfirmationCount =
    actionType === "confirmed" ? report.confirmations + 1 : report.confirmations;
  const nextResolvedCount =
    actionType === "resolved" ? report.resolvedConfirmations + 1 : report.resolvedConfirmations;
  const now = new Date().toISOString();
  const nextStatus = deriveReportLifecycleStatus({
    status: report.status,
    severity: report.severity,
    confirmationCount: nextConfirmationCount,
    resolvedCount: nextResolvedCount,
    createdAt: report.createdAt ?? now,
    updatedAt: now,
    lastActivityAt: now,
    resolvedAt:
      actionType === "resolved" && nextResolvedCount >= 3
        ? report.resolvedAt ?? now
        : report.resolvedAt ?? null,
    archivedAt: report.archivedAt ?? null,
  });

  return {
    ...report,
    confirmations: nextConfirmationCount,
    resolvedConfirmations: nextResolvedCount,
    status: nextStatus === "Archived" ? "Resolved" : nextStatus,
    updatedAt: now,
    lastActivityAt: now,
    lastActivityAgo: "Just now",
    resolvedAt:
      actionType === "resolved" && nextResolvedCount >= 3
        ? report.resolvedAt ?? now
        : report.resolvedAt,
    resolvedAgo:
      nextStatus === "Resolved"
        ? "Resolved just now"
        : nextStatus === "Likely Receded"
          ? "Likely receded just now"
          : report.resolvedAgo,
  };
}

function SelectField({
  icon,
  value,
  onChange,
  options,
}: {
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
}) {
  return (
    <label className="flex h-11 items-center gap-2 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 text-[0.9rem] text-[var(--color-foreground)] transition focus-within:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]">
      {icon}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="floodwatch-form-select w-full bg-transparent text-[0.9rem] outline-none"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function FormSection({
  step,
  title,
  description,
  tone = "default",
  children,
  optional = false,
}: {
  step: string;
  title: string;
  description: string;
  tone?: "default" | "muted";
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border p-4 shadow-[var(--shadow-soft)] md:p-5",
        tone === "muted"
          ? "border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_62%,transparent)]"
          : "border-[color:color-mix(in_srgb,var(--color-border)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)]",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[var(--color-primary-soft)] px-2 text-[0.72rem] font-semibold text-[var(--color-primary)]">
              {step}
            </span>
            {optional ? (
              <span className="text-[0.72rem] font-medium text-[var(--color-muted-foreground)]">
                Optional
              </span>
            ) : null}
          </div>
          <h2 className="mt-2 text-[1.08rem] font-semibold text-[var(--color-foreground)]">
            {title}
          </h2>
          <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
      </div>

      <div className="mt-4">{children}</div>
    </section>
  );
}

function ReportCardSkeleton() {
  return (
    <div className="animate-pulse rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2.5">
        <div className="h-10 w-10 rounded-[9px] bg-[var(--color-panel)]" />
        <div className="min-w-0 space-y-1.5">
          <div className="h-3.5 w-32 rounded-full bg-[var(--color-panel)]" />
          <div className="h-3 w-24 rounded-full bg-[var(--color-panel)]" />
          <div className="h-3 w-full rounded-full bg-[var(--color-panel)]" />
        </div>
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <div className="h-3.5 w-32 rounded-full bg-[var(--color-panel)]" />
        <div className="h-3.5 w-20 rounded-full bg-[var(--color-panel)]" />
        <div className="ml-auto h-7 w-24 rounded-[9px] bg-[var(--color-panel)]" />
        <div className="h-7 w-20 rounded-[9px] bg-[var(--color-panel)]" />
      </div>
    </div>
  );
}

function ReportCard({
  report,
  onView,
  onConfirm,
  onResolve,
  hasConfirmed,
  hasResolved,
  actionLoadingId,
}: {
  report: IncidentReport;
  onView: (report: IncidentReport) => void;
  onConfirm: (reportId: string) => void;
  onResolve: (reportId: string) => void;
  hasConfirmed: boolean;
  hasResolved: boolean;
  actionLoadingId: string | null;
}) {
  const statusPresentation = getStatusPresentation(report.status);
  const freshnessBadge = getReportFreshnessBadge(report);
  const isResolved = report.status === "Resolved";
  const isLikelyReceded = report.status === "Likely Receded";
  const isBusy = actionLoadingId === report.id;
  const thumbnailUrl = report.photos[0]?.imageUrl;
  const activityLabel = getReportActivityLabel(report);
  const canConfirm = !hasConfirmed && !isResolved && !isBusy;
  const canResolve = !hasResolved && !isResolved && !isBusy;
  const primaryOpensDetails = isResolved || hasConfirmed;
  const primaryActionLabel = isResolved
    ? "View details"
    : hasConfirmed
      ? "View details"
      : isBusy
        ? "Updating"
        : "Confirm";

  return (
    <article
      className={cn(
        "w-full rounded-[12px] border bg-[var(--color-surface)] px-3 py-2.5 transition-colors",
        isResolved
          ? "border-[var(--color-disabled-border)] opacity-72"
          : isLikelyReceded
            ? "border-[color:color-mix(in_srgb,var(--color-muted-text)_28%,transparent)]"
            : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <div className="grid min-w-0 grid-cols-[40px_minmax(0,1fr)] gap-2.5">
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-[9px] bg-[var(--color-panel)]">
          {thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnailUrl}
              alt={report.title}
              className="h-full w-full object-cover"
            />
          ) : (
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                report.severity === "severe"
                  ? "bg-[var(--color-danger)]"
                  : report.severity === "high"
                    ? "bg-[var(--color-high)]"
                    : report.severity === "moderate"
                      ? "bg-[var(--color-warning)]"
                      : "bg-[var(--color-success)]",
              )}
            />
          )}
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <span
              className={cn(
                "inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[0.64rem] font-semibold leading-4",
                severityBadgeClasses[report.severity],
              )}
            >
              {severityLabels[report.severity]}
            </span>
            <span
              className={cn(
                "inline-flex min-w-0 items-center gap-1.25 rounded-full px-2 py-0.5 text-[0.66rem] font-medium leading-4",
                statusPresentation.textClassName,
                statusPresentation.wrapperClassName,
              )}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusPresentation.dotClassName)} />
              <span className="truncate">{statusPresentation.label}</span>
            </span>
            {freshnessBadge ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.66rem] font-medium leading-4",
                  freshnessBadge.tone === "success"
                    ? "bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
                    : freshnessBadge.tone === "warning"
                      ? "bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
                      : freshnessBadge.tone === "muted"
                        ? "bg-[var(--color-muted-surface)] text-[var(--color-muted-text)]"
                        : "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
                )}
              >
                {freshnessBadge.label}
              </span>
            ) : null}
          </div>

          <div className="mt-1 line-clamp-1 text-[0.95rem] font-semibold leading-5 text-[var(--color-foreground)]">
            {report.title}
          </div>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[0.76rem] leading-4 text-[var(--color-muted-foreground)]">
            <MapPin className="h-3.25 w-3.25 shrink-0" />
            <span className="min-w-0 truncate">{report.location}</span>
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.74rem] leading-4 text-[var(--color-muted-foreground)]">
          <span className="inline-flex min-w-0 items-center gap-1.25 whitespace-nowrap">
            <Clock3 className="h-3.25 w-3.25 shrink-0" />
            <span className="font-mono tabular-nums">{activityLabel}</span>
          </span>
          <span className="whitespace-nowrap font-mono tabular-nums">
            {report.confirmations} confirmed
          </span>
        </div>

        <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-1.25 sm:w-auto sm:flex-nowrap">
          <button
            type="button"
            onClick={canConfirm ? () => onConfirm(report.id) : () => onView(report)}
            disabled={isBusy}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.25 whitespace-nowrap rounded-[9px] px-2.5 text-[0.74rem] font-semibold leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
              isResolved || hasConfirmed
                ? "border border-transparent bg-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                : canConfirm
                  ? "bg-[var(--color-primary)] text-white"
                  : "border border-[var(--color-disabled-border)] bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]",
            )}
          >
            {primaryOpensDetails ? (
              <Eye className="h-3.25 w-3.25" />
            ) : (
              <ThumbsUp className="h-3.25 w-3.25" />
            )}
            <span className="whitespace-nowrap">{primaryActionLabel}</span>
          </button>
          <button
            type="button"
            onClick={() => onResolve(report.id)}
            disabled={!canResolve}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.25 whitespace-nowrap rounded-[9px] border px-2.5 text-[0.74rem] font-medium leading-none transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]",
              canResolve
                ? "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
                : "border-[var(--color-disabled-border)] bg-transparent text-[var(--color-disabled-text)] opacity-55",
            )}
          >
            <Check className="h-3.25 w-3.25" />
            <span className="whitespace-nowrap">Receded</span>
          </button>
          {primaryOpensDetails ? null : (
            <button
              type="button"
              onClick={() => onView(report)}
              className="inline-flex h-7 items-center justify-center gap-1.25 whitespace-nowrap rounded-[9px] px-1.5 text-[0.72rem] font-medium leading-none text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
            >
              <Eye className="h-3.25 w-3.25" />
              <span className="whitespace-nowrap">View details</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function IncidentReportsContent() {
  const [reports, setReports] = useState<IncidentReport[]>([]);
  const [updatesByReportId, setUpdatesByReportId] = useState<Record<string, ReportUpdateItem[]>>({});
  const [confirmedReportIds, setConfirmedReportIds] = useState<Record<string, boolean>>({});
  const [resolvedReportIds, setResolvedReportIds] = useState<Record<string, boolean>>({});
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingReports, setLoadingReports] = useState(true);
  const [reportLoadError, setReportLoadError] = useState<string | null>(null);
  const [submittingReport, setSubmittingReport] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [pendingNearbyDuplicate, setPendingNearbyDuplicate] =
    useState<PendingNearbyDuplicateState>(null);
  const today = useSyncExternalStore(emptySubscribe, getTodaySnapshot, () => null);
  const selectedPhoto = formState.photos[0] ?? null;
  const photoPreviewUrl = useMemo(
    () => (selectedPhoto ? URL.createObjectURL(selectedPhoto) : null),
    [selectedPhoto],
  );
  const hasValidCoordinates =
    Number.isFinite(Number(formState.latitude)) && Number.isFinite(Number(formState.longitude));
  const canSubmitReport =
    formState.locationName.trim().length > 0 &&
    formState.description.trim().length > 0 &&
    hasValidCoordinates;

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  async function loadReports() {
    setLoadingReports(true);
    setReportLoadError(null);

    try {
      const response = await fetch("/api/reports?limit=50", {
        cache: "no-store",
      });
      const payload = (await response.json()) as ReportsResponse | { error: string };

      if (!response.ok || !("data" in payload)) {
        throw new Error("error" in payload ? payload.error : "Failed to load reports.");
      }

      const nextReports = payload.data.map(mapReportToIncident);
      setReports(nextReports);

      if (typeof window !== "undefined") {
        const nextConfirmed: Record<string, boolean> = {};
        const nextResolved: Record<string, boolean> = {};

        for (const report of nextReports) {
          nextConfirmed[report.id] =
            localStorage.getItem(buildStoredActionKey("confirmed", report.id)) === "true";
          nextResolved[report.id] =
            localStorage.getItem(buildStoredActionKey("resolved", report.id)) === "true";
        }

        setConfirmedReportIds(nextConfirmed);
        setResolvedReportIds(nextResolved);
      }
    } catch (error) {
      console.error("Failed to load incident reports.", error);
      setReportLoadError("Unable to load flood reports. Please check your connection and try again.");
    } finally {
      setLoadingReports(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  useEffect(() => {
    if (!pendingNearbyDuplicate) {
      return;
    }

    setPendingNearbyDuplicate(null);
  }, [
    formState.category,
    formState.description,
    formState.latitude,
    formState.locationName,
    formState.longitude,
    formState.severity,
  ]);

  useEffect(() => {
    if (!selectedReportId || !modalOpen) {
      return;
    }

    const reportId = selectedReportId;
    let isMounted = true;

    async function loadReportDetails() {
      try {
        const response = await fetch(`/api/reports/${reportId}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReportDetailResponse | { error: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load report details.");
        }

        if (!isMounted) {
          return;
        }

        const nextReport = mapReportToIncident(payload.data);
        setReports((current) =>
          current.map((report) => (report.id === nextReport.id ? nextReport : report)),
        );
        setUpdatesByReportId((current) => ({
          ...current,
          [reportId]: payload.data.updates,
        }));
      } catch (error) {
        console.error("Failed to load report detail.", error);
      }
    }

    loadReportDetails();

    return () => {
      isMounted = false;
    };
  }, [modalOpen, selectedReportId]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(
      () => {
        setToast((current) => {
          if (!current) {
            return current;
          }

          if (
            current.reportId === toast.reportId &&
            current.actionType === toast.actionType &&
            current.expiresAt === toast.expiresAt &&
            current.message === toast.message
          ) {
            return null;
          }

          return current;
        });
      },
      toast.expiresAt
        ? Math.max(0, toast.expiresAt - Date.now())
        : 3200,
    );

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const activeReports = useMemo(
    () =>
      reports
        .filter((report) => isActiveLifecycleStatus(report.status))
        .sort(compareReportsByPriority),
    [reports],
  );

  const resolvedReports = useMemo(
    () =>
      reports
        .filter((report) => isRecededLifecycleStatus(report.status))
        .sort(compareReportsByPriority),
    [reports],
  );

  const activityStats = useMemo(() => {
    const reportsToday = reports.filter(
      (report) =>
        today !== null &&
        report.createdAt &&
        new Date(report.createdAt).toDateString() === today,
    ).length;
    const activeReportedAreas = activeReports.length;
    const communityConfirmations = reports.reduce(
      (sum, report) => sum + report.confirmations,
      0,
    );

    return COMMUNITY_ACTIVITY_STATS.map((stat) => {
      if (stat.id === "reports") {
        return { ...stat, value: String(reportsToday || reports.length) };
      }

      if (stat.id === "hazards") {
        return { ...stat, value: String(activeReportedAreas) };
      }

      if (stat.id === "contributors") {
        return { ...stat, value: String(communityConfirmations) };
      }

      return stat;
    });
  }, [activeReports.length, reports, today]);

  const trendingAreas = useMemo(() => {
    const counts = new Map<string, number>();

    for (const report of reports) {
      counts.set(report.location, (counts.get(report.location) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([location]) => location);
  }, [reports]);

  function updateFormState<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    if (pendingNearbyDuplicate) {
      setPendingNearbyDuplicate(null);
    }

    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handlePhotoSelection(files: FileList | null) {
    const selectedPhoto = files?.[0];

    if (!selectedPhoto) {
      updateFormState("photos", []);
      return;
    }

    const validationError = validateReportImageFile(selectedPhoto);

    if (validationError) {
      updateFormState("photos", []);
      setToast({
        tone: "error",
        message: validationError,
      });
      return;
    }

    updateFormState("photos", [selectedPhoto]);
  }

  async function handleConfirmReport(reportId: string) {
    if (confirmedReportIds[reportId]) {
      return;
    }

    const previousReports = reports;
    const previousConfirmedReportIds = confirmedReportIds;
    setActionLoadingId(reportId);
    setConfirmedReportIds((current) => ({
      ...current,
      [reportId]: true,
    }));
    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? applyOptimisticReportAction(report, "confirmed") : report,
      ),
    );

    try {
      const response = await fetch(`/api/reports/${reportId}/confirm`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to confirm the report.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(buildStoredActionKey("confirmed", reportId), "true");
      }

      setReports((current) =>
        current.map((report) =>
          report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
        ),
      );
      setToast({
        tone: "success",
        message: "Report confirmed.",
        actionType: "confirmed",
        reportId,
        expiresAt: Date.now() + REPORT_ACTION_UNDO_WINDOW_MS,
      });
    } catch (error) {
      console.error("Failed to confirm report.", error);
      setReports(previousReports);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("confirmed", reportId), "true");
        }

        setConfirmedReportIds((current) => ({
          ...current,
          [reportId]: true,
        }));
      } else {
        setConfirmedReportIds(previousConfirmedReportIds);
      }
      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Unable to confirm this report right now.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResolveReport(reportId: string) {
    if (resolvedReportIds[reportId]) {
      return;
    }

    const previousReports = reports;
    const previousResolvedReportIds = resolvedReportIds;
    setActionLoadingId(reportId);
    setResolvedReportIds((current) => ({
      ...current,
      [reportId]: true,
    }));
    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? applyOptimisticReportAction(report, "resolved") : report,
      ),
    );

    try {
      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
        headers: createReportActionHeaders(),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to update the report.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(buildStoredActionKey("resolved", reportId), "true");
      }

      setReports((current) =>
        current.map((report) =>
          report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
        ),
      );
      setToast({
        tone: "success",
        message: "Water receded report submitted.",
        actionType: "resolved",
        reportId,
        expiresAt: Date.now() + REPORT_ACTION_UNDO_WINDOW_MS,
      });
    } catch (error) {
      console.error("Failed to resolve report.", error);
      setReports(previousReports);
      if (
        error instanceof Error &&
        error.message === "This report has already been updated from this browser."
      ) {
        if (typeof window !== "undefined") {
          localStorage.setItem(buildStoredActionKey("resolved", reportId), "true");
        }

        setResolvedReportIds((current) => ({
          ...current,
          [reportId]: true,
        }));
      } else {
        setResolvedReportIds(previousResolvedReportIds);
      }
      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Unable to submit a water receded report right now.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUndoAction() {
    if (
      !toast ||
      !toast.actionType ||
      !toast.reportId ||
      !toast.expiresAt ||
      toast.pending
    ) {
      return;
    }

    if (Date.now() >= toast.expiresAt) {
      setToast({
        tone: "error",
        message: "Undo window has expired.",
      });
      return;
    }

    const actionType = toast.actionType;
    const reportId = toast.reportId;

    setToast((current) =>
      current &&
      current.actionType === actionType &&
      current.reportId === reportId
        ? {
            ...current,
            pending: true,
          }
        : current,
    );

    try {
      const response = await fetch(
        actionType === "confirmed"
          ? `/api/reports/${reportId}/confirm`
          : `/api/reports/${reportId}/resolve`,
        {
          method: "DELETE",
          headers: createReportActionHeaders(),
        },
      );
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Unable to undo this action.");
      }

      setReports((current) =>
        current.map((report) =>
          report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
        ),
      );

      if (actionType === "confirmed") {
        setConfirmedReportIds((current) => {
          const next = { ...current };
          delete next[reportId];
          return next;
        });
      } else {
        setResolvedReportIds((current) => {
          const next = { ...current };
          delete next[reportId];
          return next;
        });
      }

      if (typeof window !== "undefined") {
        localStorage.removeItem(buildStoredActionKey(actionType, reportId));
      }

      setToast({
        tone: "success",
        message:
          actionType === "confirmed"
            ? "Confirmation removed."
            : "Water receded report removed.",
      });
    } catch (error) {
      setToast({
        tone: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Unable to undo this action.",
      });
    }
  }

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setToast({
        tone: "error",
        message: "Current location is not supported on this browser.",
      });
      return;
    }

    setLoadingCurrentLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude.toFixed(6);
        const longitude = position.coords.longitude.toFixed(6);

        updateFormState("latitude", latitude);
        updateFormState("longitude", longitude);

        try {
          const result = await fetchWeatherLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            name: "Your Location",
          });
          const resolvedLocationName = result.resolvedAddress?.trim() || result.location.name.trim();

          if (resolvedLocationName) {
            updateFormState("locationName", resolvedLocationName);
          }
        } catch {
          setToast({
            tone: "error",
            message: "Current coordinates added. Enter the location name manually if needed.",
          });
        } finally {
          setLoadingCurrentLocation(false);
        }
      },
      () => {
        setLoadingCurrentLocation(false);
        setToast({
          tone: "error",
          message: "Unable to read your current location.",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  }

  function handleUsePickedLocation(location: {
    locationName: string;
    latitude: string;
    longitude: string;
  }) {
    if (pendingNearbyDuplicate) {
      setPendingNearbyDuplicate(null);
    }

    setFormState((current) => ({
      ...current,
      locationName: location.locationName,
      latitude: location.latitude,
      longitude: location.longitude,
    }));
    setLocationPickerOpen(false);
  }

  async function submitPreparedReport(requestBody: FormData, photoAttached: boolean) {
    const response = await fetch("/api/reports", {
      method: "POST",
      body: requestBody,
    });
    const payload = (await response.json()) as { data?: ReportRecord; error?: string };

    if (!response.ok || !payload.data) {
      throw new Error(payload.error ?? "Failed to submit report.");
    }

    setReports((current) =>
      [mapReportToIncident(payload.data as ReportRecord), ...current].sort(compareReportsByPriority),
    );
    setFormState(emptyFormState);
    setPendingNearbyDuplicate(null);
    setToast({
      tone: "success",
      message: photoAttached
        ? "Community report and photo submitted successfully."
        : "Community report submitted successfully.",
    });
  }

  async function handleSubmitReport(skipNearbyDuplicateCheck = false) {
    if (!formState.locationName.trim()) {
      setToast({ tone: "error", message: "Location name is required." });
      return;
    }

    if (!formState.description.trim()) {
      setToast({ tone: "error", message: "Description is required." });
      return;
    }

    const latitude = Number(formState.latitude);
    const longitude = Number(formState.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setToast({
        tone: "error",
        message: "Latitude and longitude are required for public reports.",
      });
      return;
    }

    if (selectedPhoto) {
      const imageValidationError = validateReportImageFile(selectedPhoto);

      if (imageValidationError) {
        setToast({
          tone: "error",
          message: imageValidationError,
        });
        return;
      }
    }

    setSubmittingReport(true);

    try {
      const title = `${formState.category} at ${formState.locationName}`.slice(0, 120);
      const requestBody = new FormData();
      requestBody.set("title", title);
      requestBody.set("description", formState.description.trim());
      requestBody.set("category", formState.category);
      requestBody.set("severity", formState.severity);
      requestBody.set("locationName", formState.locationName.trim());
      requestBody.set("latitude", String(latitude));
      requestBody.set("longitude", String(longitude));

      if (!formState.submitAnonymously && formState.reportedByName.trim()) {
        requestBody.set("reportedByName", formState.reportedByName.trim());
      }

      if (selectedPhoto) {
        requestBody.set("image", selectedPhoto);
      }

      if (!skipNearbyDuplicateCheck) {
        const nearbyResponse = await fetch(
          `/api/reports/nearby?lat=${encodeURIComponent(String(latitude))}&lng=${encodeURIComponent(String(longitude))}&radiusMeters=300&limit=3`,
          {
            cache: "no-store",
          },
        );
        const nearbyPayload =
          (await nearbyResponse.json()) as NearbyReportsResponse | { error?: string };

        if (!nearbyResponse.ok || !("data" in nearbyPayload)) {
          throw new Error(
            "error" in nearbyPayload && nearbyPayload.error
              ? nearbyPayload.error
              : "Unable to check nearby reports right now.",
          );
        }

        if (nearbyPayload.data.length > 0) {
          setPendingNearbyDuplicate({
            nearbyReports: nearbyPayload.data,
            requestBody,
            photoAttached: Boolean(selectedPhoto),
          });
          return;
        }
      }

      await submitPreparedReport(requestBody, Boolean(selectedPhoto));
    } catch (error) {
      console.error("Failed to submit report.", error);
      setToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit your report right now.",
      });
    } finally {
      setSubmittingReport(false);
    }
  }

  async function handleContinueNewReport() {
    if (!pendingNearbyDuplicate) {
      return;
    }

    setSubmittingReport(true);

    try {
      await submitPreparedReport(
        pendingNearbyDuplicate.requestBody,
        pendingNearbyDuplicate.photoAttached,
      );
    } catch (error) {
      console.error("Failed to submit report after duplicate warning.", error);
      setToast({
        tone: "error",
        message:
          error instanceof Error
            ? error.message
            : "Unable to submit your report right now.",
      });
    } finally {
      setSubmittingReport(false);
    }
  }

  async function handleConfirmNearbyDuplicate() {
    const nearestReportId = pendingNearbyDuplicate?.nearbyReports[0]?.id;

    if (!nearestReportId) {
      return;
    }

    setPendingNearbyDuplicate(null);
    await handleConfirmReport(nearestReportId);
  }

  return (
    <>
      <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
        <div className="mx-auto flex min-h-full w-full max-w-[1440px] flex-col gap-5 px-4 py-5 md:px-6 md:py-6 xl:px-8">
          <section>
            <h1 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
              Report an Incident
            </h1>
            <p className="mt-1.5 text-[0.95rem] text-[var(--color-muted-foreground)]">
              Submit flood, weather-related, and community hazard reports to help improve public awareness and situational monitoring.
            </p>
          </section>

          <section className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_396px]">
            <div className="space-y-4">
              <section className="rounded-[18px] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-4 py-3.5 shadow-[var(--shadow-soft)]">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4.5 w-4.5 shrink-0 text-[var(--color-warning)]" />
                  <div className="min-w-0">
                    <div className="text-[0.88rem] font-semibold text-[var(--color-foreground)]">
                      Safety notice
                    </div>
                    <p className="mt-1 text-[0.82rem] leading-6 text-[var(--color-foreground)]">
                      Do not enter flooded or dangerous areas to collect photos or coordinates. Report from a safe location whenever possible.
                    </p>
                  </div>
                </div>
              </section>

              <FormSection
                step="1"
                title="Location"
                description="Enter a public place name and coordinates so the report can appear accurately on the live map."
              >
                <div className="grid gap-3">
                  <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]">
                    <label className="flex h-11 items-center gap-3 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 transition focus-within:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus-within:ring-2 focus-within:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]">
                      <MapPin className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                      <input
                        type="text"
                        value={formState.locationName}
                        onChange={(event) => updateFormState("locationName", event.target.value)}
                        placeholder="Street, barangay, city"
                        className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={handleUseCurrentLocation}
                      disabled={loadingCurrentLocation}
                      className="flex h-11 items-center justify-center gap-2 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-4 text-[0.88rem] font-medium text-[var(--color-foreground)] transition hover:bg-[var(--color-panel)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loadingCurrentLocation ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Phone className="h-4 w-4" />
                      )}
                      <span>{loadingCurrentLocation ? "Detecting location..." : "Use current location"}</span>
                    </button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                    <label className="grid gap-1.5">
                      <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                        Latitude
                      </span>
                      <input
                        type="text"
                        value={formState.latitude}
                        onChange={(event) => updateFormState("latitude", event.target.value)}
                        placeholder="14.599500"
                        className="tabular-nums h-11 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
                      />
                    </label>
                    <label className="grid gap-1.5">
                      <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                        Longitude
                      </span>
                      <input
                        type="text"
                        value={formState.longitude}
                        onChange={(event) => updateFormState("longitude", event.target.value)}
                        placeholder="120.984200"
                        className="tabular-nums h-11 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
                      />
                    </label>
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={() => setLocationPickerOpen(true)}
                        className="flex h-11 w-full items-center justify-center gap-2 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_78%,transparent)] px-4 text-[0.88rem] font-medium text-[var(--color-primary)] transition hover:bg-[var(--color-panel)] xl:w-auto"
                      >
                        <MapIcon className="h-4 w-4" />
                        <span>Pick on map</span>
                      </button>
                    </div>
                  </div>
                </div>
              </FormSection>

              <FormSection
                step="2"
                title="Incident details"
                description="Choose the incident type, severity, and water depth, then add a short factual summary of current conditions."
              >
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="grid gap-1.5">
                    <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                      Incident type
                    </span>
                    <SelectField
                      icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />}
                      value={formState.category}
                      onChange={(value) => updateFormState("category", value)}
                      options={INCIDENT_CATEGORY_OPTIONS}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                      Severity level
                    </span>
                    <SelectField
                      icon={<span className="h-3.5 w-3.5 rounded-full bg-[var(--color-warning)]" />}
                      value={formState.severity}
                      onChange={(value) => updateFormState("severity", value)}
                      options={REPORT_SEVERITIES}
                    />
                  </div>

                  <div className="grid gap-1.5">
                    <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                      Water depth
                    </span>
                    <SelectField
                      icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />}
                      value={formState.waterDepth}
                      onChange={(value) => updateFormState("waterDepth", value)}
                      options={WATER_DEPTH_OPTIONS}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-1.5">
                  <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                    Description
                  </span>
                  <textarea
                    rows={4}
                    value={formState.description}
                    onChange={(event) => updateFormState("description", event.target.value)}
                    placeholder="Describe the situation, affected roads or neighborhoods, visible hazards, and any people needing assistance."
                    className="w-full rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 py-3 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
                  />
                </div>
              </FormSection>

              <FormSection
                step="3"
                title="Photo evidence"
                description="Add one optional image to help other residents verify the report. Keep uploads clear and relevant."
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[0.84rem] font-medium text-[var(--color-foreground)]">
                    Upload image
                  </div>
                  <div className="tabular-nums text-[0.78rem] text-[var(--color-muted-foreground)]">
                    {formState.photos.length} / 1 image
                  </div>
                </div>

                <label className="mt-3 flex cursor-pointer flex-col rounded-[14px] border border-dashed border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_84%,transparent)] px-4 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] bg-[color:color-mix(in_srgb,var(--color-surface)_96%,transparent)] text-[var(--color-muted-foreground)]">
                        <ImageUp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[0.92rem] font-medium text-[var(--color-foreground)]">
                          Add a supporting photo
                        </div>
                        <div className="mt-1 text-[0.82rem] text-[var(--color-muted-foreground)]">
                          Click to browse or drop one JPG, PNG, or WEBP image up to 5 MB.
                        </div>
                      </div>
                    </div>
                    <div className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3 py-2 text-[0.8rem] font-medium text-[var(--color-foreground)]">
                      Choose file
                    </div>
                  </div>
                  <input
                    type="file"
                    accept={reportImageAcceptValue}
                    className="sr-only"
                    onChange={(event) => handlePhotoSelection(event.target.files)}
                  />
                </label>

                {formState.photos[0] ? (
                  <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-3">
                    {photoPreviewUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={photoPreviewUrl}
                        alt={formState.photos[0].name}
                        className="h-16 w-16 rounded-[12px] object-cover"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="truncate text-[0.88rem] font-medium text-[var(--color-foreground)]">
                        {formState.photos[0].name}
                      </div>
                      <div className="mt-1 text-[0.8rem] text-[var(--color-muted-foreground)]">
                        Photo ready to upload with this report.
                      </div>
                    </div>
                  </div>
                ) : null}
              </FormSection>

              <FormSection
                step="4"
                title="Reporter information"
                description="Add your name or contact number only if follow-up may be needed. You can still submit anonymously."
                tone="muted"
                optional
              >
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="grid gap-1.5">
                    <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                      Reporter name
                    </span>
                    <input
                      type="text"
                      value={formState.reportedByName}
                      onChange={(event) => updateFormState("reportedByName", event.target.value)}
                      placeholder="Your name or organization"
                      className="h-11 w-full rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
                    />
                  </label>
                  <label className="grid gap-1.5">
                    <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
                      Contact number
                    </span>
                    <input
                      type="text"
                      value={formState.contactNumber}
                      onChange={(event) => updateFormState("contactNumber", event.target.value)}
                      placeholder="09xx xxx xxxx"
                      className="h-11 w-full rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]"
                    />
                  </label>
                </div>

                <label className="mt-4 flex items-start gap-3 rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3.5 py-3 text-[0.88rem] text-[var(--color-foreground)]">
                  <input
                    type="checkbox"
                    checked={formState.submitAnonymously}
                    onChange={(event) =>
                      updateFormState("submitAnonymously", event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border border-[var(--color-border)]"
                  />
                  <span>Submit anonymously. Your personal details will not appear on the public report feed.</span>
                </label>
              </FormSection>

              {pendingNearbyDuplicate ? (
                <div className="rounded-[16px] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-4 py-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-warning)]" />
                    <div className="min-w-0 flex-1">
                      <div className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
                        Nearby active report found within 300 m
                      </div>
                      <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                        A nearby community report is already active. Confirm the existing report if it matches this incident, or continue with a separate report.
                      </p>
                      <div className="mt-3 space-y-2">
                        {pendingNearbyDuplicate.nearbyReports.map((nearbyReport) => (
                          <div
                            key={nearbyReport.id}
                            className="rounded-[12px] border border-[var(--color-disabled-border)] bg-[var(--color-surface)] px-3 py-2"
                          >
                            <div className="text-[0.86rem] font-semibold text-[var(--color-foreground)]">
                              {nearbyReport.title}
                            </div>
                            <div className="mt-1 tabular-nums text-[0.78rem] text-[var(--color-muted-foreground)]">
                              {nearbyReport.locationName} · ~{Math.max(1, Math.round(nearbyReport.distanceMeters))} m away
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[0.78rem] text-[var(--color-muted-foreground)]">
                        Distances are approximate direct distances. Actual travel distance may be longer.
                      </p>
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={handleConfirmNearbyDuplicate}
                          disabled={submittingReport || actionLoadingId !== null}
                          className="flex h-10 items-center justify-center rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.9rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Confirm existing nearby report
                        </button>
                        <button
                          type="button"
                          onClick={handleContinueNewReport}
                          disabled={submittingReport}
                          className="flex h-10 items-center justify-center rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)] disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Continue submitting new report
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <FormSection
                step="5"
                title="Submit actions"
                description="Review the required location and incident fields before sending the report."
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                    {!canSubmitReport
                      ? "Location name, coordinates, and incident description are required before submission."
                      : "Form ready. Submit the report to publish it to the community incident feed."}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => {
                        setFormState(emptyFormState);
                        setPendingNearbyDuplicate(null);
                      }}
                      className="h-11 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)]"
                    >
                      Clear form
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleSubmitReport()}
                      disabled={submittingReport || !canSubmitReport}
                      className={cn(
                        "flex h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-[0.92rem] font-semibold text-white",
                        submittingReport || !canSubmitReport
                          ? "cursor-not-allowed border border-[var(--color-disabled-border)] bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]"
                          : "bg-[var(--color-primary)]",
                      )}
                    >
                      {submittingReport ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>{submittingReport ? "Uploading report..." : "Submit report"}</span>
                    </button>
                  </div>
                </div>
              </FormSection>
            </div>

            <div className="flex min-h-0 flex-col gap-4 lg:sticky lg:top-4 lg:h-[calc(100dvh-var(--header-height)-2rem)] lg:self-start lg:overflow-hidden">
              <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto lg:pr-1">
                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[0.92rem] font-semibold text-[var(--color-foreground)]">
                    Submission guide
                  </div>
                  <div className="mt-4 space-y-3">
                    {[
                      "Add a clear public location and coordinates.",
                      "Choose the closest incident type, severity, and water depth.",
                      "Write a short factual description of what people need to know now.",
                      "Add one photo only if it helps verify the report safely.",
                    ].map((item, index) => (
                      <div key={item} className="flex items-start gap-3">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-primary-soft)] text-[0.74rem] font-semibold text-[var(--color-primary)]">
                          {index + 1}
                        </span>
                        <p className="text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                    Community activity
                  </div>
                  <div className="mt-4 space-y-3">
                    {activityStats.map((stat) => {
                      const Icon = stat.icon;
                      return (
                        <div key={stat.id} className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2.5 text-[0.9rem] text-[var(--color-foreground)]">
                            <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                            <span>{stat.label}</span>
                          </div>
                          <span className="tabular-nums text-[1.18rem] font-semibold text-[var(--color-foreground)]">
                            {stat.value}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                    <div className="flex items-center gap-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
                      <Flame className="h-4 w-4 text-[var(--color-warning)]" />
                      <span>Trending areas</span>
                    </div>
                    <ul className="mt-2 space-y-1 text-[0.88rem] text-[var(--color-foreground)]">
                      {(trendingAreas.length > 0 ? trendingAreas : ["No active hotspots yet"]).map((area) => (
                        <li key={area}>• {area}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-info-surface)] p-4 shadow-[var(--shadow-soft)]">
                  <div className="text-[0.96rem] font-semibold text-[var(--color-primary)]">
                    Community reports
                  </div>
                  <p className="mt-2 text-[0.84rem] leading-6 text-[var(--color-primary)]">
                    Community reports are not official advisories. Follow LGU and PAGASA updates.
                  </p>
                  <p className="mt-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
                    Reports may be hidden after they are resolved or inactive.
                  </p>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--color-border)] bg-transparent">
                <div className="px-1 pb-4 pt-3">
                  <div className="px-3 pb-3 pt-1 text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                    Active reports
                  </div>
                  {loadingReports ? (
                    <div className="activeReportsScrollArea px-2 pb-3 sm:px-3">
                      <div className="space-y-2.5 px-1 py-3">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <ReportCardSkeleton key={`active-skeleton-${index}`} />
                        ))}
                      </div>
                    </div>
                  ) : reportLoadError ? (
                    <div className="rounded-[14px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-4 py-3 text-[0.88rem] text-[var(--color-danger-text)]">
                      {reportLoadError}
                    </div>
                  ) : (
                    <div className="activeReportsScrollArea px-2 pb-3 sm:px-3">
                      <div className="space-y-2.5 px-1 py-3">
                        {activeReports.length > 0 ? (
                          activeReports.map((report) => (
                            <ReportCard
                              key={report.id}
                              report={report}
                              hasConfirmed={Boolean(confirmedReportIds[report.id])}
                              hasResolved={Boolean(resolvedReportIds[report.id])}
                              actionLoadingId={actionLoadingId}
                              onConfirm={handleConfirmReport}
                              onResolve={handleResolveReport}
                              onView={(nextReport) => {
                                setSelectedReportId(nextReport.id);
                                setModalOpen(true);
                              }}
                            />
                          ))
                        ) : (
                          <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.88rem] text-[var(--color-muted-foreground)]">
                            No active flood reports right now. You can still monitor conditions and check again later.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mx-3 mt-1 border-t border-[color:color-mix(in_srgb,var(--color-border)_55%,transparent)]" />
                  <div className="px-3 pb-3 pt-4 text-[0.9rem] font-semibold text-[var(--color-foreground)]">
                    Recently receded reports
                  </div>
                  {loadingReports ? (
                    <div className="space-y-2.5 px-2 pb-3 sm:px-3">
                      {Array.from({ length: 2 }).map((_, index) => (
                        <ReportCardSkeleton key={`resolved-skeleton-${index}`} />
                      ))}
                    </div>
                  ) : reportLoadError ? (
                    <div className="space-y-2.5 px-2 pb-3 sm:px-3">
                      <div className="rounded-[14px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-4 py-3 text-[0.88rem] text-[var(--color-danger-text)]">
                        {reportLoadError}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 px-2 pb-3 sm:px-3">
                      {resolvedReports.length > 0 ? (
                        resolvedReports.map((report) => (
                          <ReportCard
                            key={report.id}
                            report={report}
                            hasConfirmed={Boolean(confirmedReportIds[report.id])}
                            hasResolved={Boolean(resolvedReportIds[report.id])}
                            actionLoadingId={actionLoadingId}
                            onConfirm={handleConfirmReport}
                            onResolve={handleResolveReport}
                            onView={(nextReport) => {
                              setSelectedReportId(nextReport.id);
                              setModalOpen(true);
                            }}
                          />
                        ))
                      ) : (
                        <div className="rounded-[14px] border border-[var(--color-disabled-border)] bg-[var(--color-muted-surface)] px-4 py-3 text-[0.88rem] text-[var(--color-muted-text)]">
                          No recently receded reports yet.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="h-20 md:hidden" />
        </div>
      </div>

      <IncidentReportModal
        key={selectedReportId ?? "empty"}
        report={selectedReport}
        updates={selectedReportId ? updatesByReportId[selectedReportId] ?? [] : []}
        open={modalOpen}
        actionLoading={actionLoadingId === selectedReportId}
        hasConfirmed={selectedReportId ? Boolean(confirmedReportIds[selectedReportId]) : false}
        hasResolved={selectedReportId ? Boolean(resolvedReportIds[selectedReportId]) : false}
        onConfirm={handleConfirmReport}
        onResolve={handleResolveReport}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedReportId(null);
          }
        }}
      />

      {locationPickerOpen ? (
        <IncidentLocationPicker
          open={locationPickerOpen}
          initialLocationName={formState.locationName}
          initialLatitude={formState.latitude}
          initialLongitude={formState.longitude}
          onClose={() => setLocationPickerOpen(false)}
          onConfirm={handleUsePickedLocation}
        />
      ) : null}

      {toast ? <UndoToast toast={toast} onUndo={handleUndoAction} /> : null}
    </>
  );
}
