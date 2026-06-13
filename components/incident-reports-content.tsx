"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
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
  X,
} from "lucide-react";

import {
  COMMUNITY_ACTIVITY_STATS,
  INCIDENT_CATEGORY_OPTIONS,
  REPORT_SEVERITIES,
  RESOLVED_CONFIRMATION_THRESHOLD,
  WATER_DEPTH_OPTIONS,
} from "@/lib/constants";
import {
  deriveCommunityStatus,
  formatCountLabel,
  formatRelativeTime,
  getReportCategoryLabel,
  getReportSeverityTone,
  getSourceLabel,
  toCoordinatesLabel,
} from "@/lib/reporting";
import type { AlertSeverity, IncidentReport, IncidentReportStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type ReportUpdateItem = {
  id: string;
  updateType: string;
  message: string;
  createdAt: string;
};

type ReportRecord = {
  id: string;
  title: string;
  description: string;
  category: string;
  severity: string;
  status: string;
  locationName: string;
  latitude: number;
  longitude: number;
  imageUrl: string | null;
  reportedByName: string | null;
  sourceType: "Community" | "Official" | "System";
  confirmationCount: number;
  resolvedCount: number;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};

type ReportDetailRecord = ReportRecord & {
  updates: ReportUpdateItem[];
};

type ReportsResponse = {
  data: ReportRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

type ReportDetailResponse = {
  data: ReportDetailRecord;
};

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
} | null;

const severityBadgeClasses: Record<AlertSeverity, string> = {
  safe: "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
  moderate:
    "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
  high: "border-[rgba(249,115,22,0.34)] bg-[rgba(249,115,22,0.08)] text-[var(--color-high)]",
  severe:
    "border-[rgba(239,68,68,0.34)] bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)]",
};

const severityLabels: Record<AlertSeverity, string> = {
  safe: "Low",
  moderate: "Moderate",
  high: "High",
  severe: "Critical",
};

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

function buildStoredActionKey(type: "confirmed" | "resolved", reportId: string) {
  return `${type}_report_${reportId}`;
}

function getStatusPresentation(status: IncidentReportStatus) {
  if (status === "Resolved") {
    return {
      dotClassName: "bg-slate-400",
      textClassName: "text-slate-500",
      wrapperClassName: "bg-[rgba(148,163,184,0.08)]",
      label: "Resolved",
    };
  }

  if (status === "Possibly Resolved") {
    return {
      dotClassName: "bg-[#475569]",
      textClassName: "text-[#475569]",
      wrapperClassName: "bg-[rgba(71,85,105,0.08)]",
      label: "Possibly Resolved",
    };
  }

  if (status === "Confirmed by Community") {
    return {
      dotClassName: "bg-[#22c55e]",
      textClassName: "text-[#22c55e]",
      wrapperClassName: "bg-[rgba(34,197,94,0.08)]",
      label: "Confirmed by Community",
    };
  }

  return {
    dotClassName: "bg-[var(--color-warning)]",
    textClassName: "text-[var(--color-warning)]",
    wrapperClassName: "bg-[rgba(245,158,11,0.08)]",
    label: "Needs More Confirmation",
  };
}

function createPlaceholderPhotos(report: ReportRecord) {
  return [
    {
      id: `${report.id}-placeholder`,
      label: report.title,
      accent:
        report.resolvedCount >= RESOLVED_CONFIRMATION_THRESHOLD
          ? "from-emerald-50 to-slate-100"
          : report.confirmationCount >= 3
            ? "from-sky-100 to-slate-100"
            : "from-zinc-100 to-slate-200",
    },
  ];
}

function mapReportToIncident(report: ReportRecord): IncidentReport {
  const severityTone = getReportSeverityTone(report.severity);

  return {
    id: report.id,
    title: report.title,
    location: report.locationName,
    coordinatesLabel: toCoordinatesLabel(report.latitude, report.longitude),
    category: getReportCategoryLabel(report.category),
    severity: severityTone,
    status: deriveCommunityStatus({
      status: report.status,
      confirmationCount: report.confirmationCount,
      resolvedCount: report.resolvedCount,
      resolvedAt: report.resolvedAt,
    }),
    description: report.description,
    createdAt: report.createdAt,
    reportedAgo: formatRelativeTime(report.createdAt),
    confirmations: report.confirmationCount,
    resolvedConfirmations: report.resolvedCount,
    sourceType: report.sourceType,
    resolvedAgo:
      report.status === "Resolved" || report.resolvedAt
        ? `Resolved ${formatRelativeTime(report.resolvedAt ?? report.updatedAt)}`
        : report.resolvedCount >= RESOLVED_CONFIRMATION_THRESHOLD
          ? `Possibly resolved ${formatRelativeTime(report.updatedAt)}`
          : undefined,
    reporter: report.reportedByName ?? "Anonymous Community Reporter",
    sourceUnit: getSourceLabel(report.sourceType),
    photos: createPlaceholderPhotos(report),
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
    <label className="flex h-10 items-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] text-[var(--color-foreground)] shadow-[var(--shadow-soft)]">
      {icon}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-transparent text-[0.9rem] outline-none"
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

function IncidentReportModal({
  report,
  updates,
  open,
  onOpenChange,
  onConfirm,
  onResolve,
  hasConfirmed,
  hasResolved,
  actionLoading,
}: {
  report: IncidentReport | null;
  updates: ReportUpdateItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reportId: string) => void;
  onResolve: (reportId: string) => void;
  hasConfirmed: boolean;
  hasResolved: boolean;
  actionLoading: boolean;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  if (!open || !report) {
    return null;
  }

  const photos = report.photos;
  const currentPhoto = photos[photoIndex] ?? photos[0];
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
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br",
                currentPhoto.accent,
              )}
            />
            <div className="absolute inset-0 flex items-center justify-center px-8 text-center text-[1.05rem] font-medium text-[var(--color-muted-foreground)]">
              {currentPhoto.label}
            </div>

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
                  MARKED RESOLVED
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <Check className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{formatCountLabel(report.resolvedConfirmations)}</span>
                </div>
              </div>
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
              <span>{hasConfirmed ? "Report Confirmed" : "Confirm Report"}</span>
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
              <span>{hasResolved ? "Marked as Resolved" : "Mark as Resolved"}</span>
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
  const isResolved = report.status === "Resolved";
  const isBusy = actionLoadingId === report.id;

  return (
    <article
      className={cn(
        "mx-auto w-full max-w-[360px] rounded-[18px] border p-4 shadow-[var(--shadow-soft)] transition-opacity",
        isResolved
          ? "border-[rgba(148,163,184,0.28)] bg-[rgba(148,163,184,0.08)] opacity-75"
          : "border-[var(--color-border)] bg-[var(--color-surface)]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[0.98rem] font-semibold leading-7 text-[var(--color-foreground)]">
            {report.title}
          </div>
          <div className="mt-1 flex items-start gap-2 text-[0.86rem] text-[var(--color-muted-foreground)]">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0">{report.location}</span>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex max-w-[106px] shrink-0 items-center justify-center rounded-full border px-2.5 py-1 text-center text-[0.7rem] font-semibold leading-5",
            severityBadgeClasses[report.severity],
          )}
        >
          {severityLabels[report.severity]}
        </span>
      </div>

      <div className="mt-3 text-[0.88rem] text-[var(--color-muted-foreground)]">
        {report.category}
      </div>
      <div
        className={cn(
          "mt-2.5 inline-flex min-h-9 w-full items-center gap-2 rounded-[11px] px-3 py-2 text-[0.84rem] font-medium leading-5",
          statusPresentation.textClassName,
          statusPresentation.wrapperClassName,
        )}
      >
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", statusPresentation.dotClassName)} />
        <span>{statusPresentation.label}</span>
      </div>

      <div className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
        {report.sourceUnit}
      </div>

      <div className="mt-3 rounded-[14px] border border-transparent bg-[var(--color-panel)] px-3.5 py-3 text-[0.84rem] font-medium leading-5 text-[var(--color-foreground)]">
        Confirmations: {formatCountLabel(report.confirmations)}
      </div>
      <div className="mt-2 rounded-[14px] border border-[rgba(148,163,184,0.2)] bg-[rgba(248,250,252,0.72)] px-3.5 py-3 text-[0.84rem] font-medium leading-5 text-[var(--color-foreground)]">
        Marked Resolved: {formatCountLabel(report.resolvedConfirmations)}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 text-[0.82rem] text-[var(--color-muted-foreground)]">
        <div className="flex min-w-0 items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          <span className="truncate">{report.resolvedAgo ?? report.reportedAgo}</span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onView(report)}
          className="flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-[0.9rem] font-medium text-[var(--color-foreground)]"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View</span>
        </button>
        <button
          type="button"
          onClick={() => onConfirm(report.id)}
          disabled={hasConfirmed || isResolved || isBusy}
          className={cn(
            "flex h-11 items-center justify-center gap-2 rounded-[12px] border px-3 text-[0.9rem] font-medium",
            hasConfirmed || isResolved || isBusy
              ? "border-[rgba(148,163,184,0.2)] bg-[rgba(148,163,184,0.12)] text-slate-500"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
          )}
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span>{hasConfirmed ? "Report Confirmed" : "Confirm"}</span>
        </button>
        <button
          type="button"
          onClick={() => onResolve(report.id)}
          disabled={hasResolved || isResolved || isBusy}
          className={cn(
            "col-span-2 flex h-11 items-center justify-center gap-2 rounded-[12px] border px-4 text-[0.9rem] font-medium",
            hasResolved || isResolved || isBusy
              ? "border-[rgba(148,163,184,0.24)] bg-[rgba(148,163,184,0.12)] text-slate-500"
              : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)]",
          )}
        >
          <Check className="h-3.5 w-3.5" />
          <span>{hasResolved ? "Marked as Resolved" : "Mark as Resolved"}</span>
        </button>
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
  const [submittingReport, setSubmittingReport] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [loadingCurrentLocation, setLoadingCurrentLocation] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [formState, setFormState] = useState<FormState>(emptyFormState);
  const [today] = useState(() => new Date().toDateString());

  useEffect(() => {
    let isMounted = true;

    async function loadReports() {
      setLoadingReports(true);

      try {
        const response = await fetch("/api/reports?limit=50", {
          cache: "no-store",
        });
        const payload = (await response.json()) as ReportsResponse | { error: string };

        if (!response.ok || !("data" in payload)) {
          throw new Error("error" in payload ? payload.error : "Failed to load reports.");
        }

        if (!isMounted) {
          return;
        }

        const nextReports = payload.data.map(mapReportToIncident);
        setReports(nextReports);

        if (typeof window !== "undefined") {
          const nextConfirmed: Record<string, boolean> = {};
          const nextResolved: Record<string, boolean> = {};

          for (const report of nextReports) {
            nextConfirmed[report.id] = localStorage.getItem(buildStoredActionKey("confirmed", report.id)) === "true";
            nextResolved[report.id] = localStorage.getItem(buildStoredActionKey("resolved", report.id)) === "true";
          }

          setConfirmedReportIds(nextConfirmed);
          setResolvedReportIds(nextResolved);
        }
      } catch (error) {
        console.error("Failed to load incident reports.", error);
        setToast({
          tone: "error",
          message: "Unable to load live community reports right now.",
        });
      } finally {
        if (isMounted) {
          setLoadingReports(false);
        }
      }
    }

    loadReports();

    return () => {
      isMounted = false;
    };
  }, []);

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

    const timeout = window.setTimeout(() => {
      setToast(null);
    }, 3200);

    return () => window.clearTimeout(timeout);
  }, [toast]);

  const selectedReport = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId],
  );

  const activeReports = useMemo(
    () => reports.filter((report) => report.status !== "Resolved"),
    [reports],
  );

  const resolvedReports = useMemo(
    () => reports.filter((report) => report.status === "Resolved"),
    [reports],
  );

  const activityStats = useMemo(() => {
    const reportsToday = reports.filter(
      (report) => report.createdAt && new Date(report.createdAt).toDateString() === today,
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
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function handleConfirmReport(reportId: string) {
    if (confirmedReportIds[reportId]) {
      return;
    }

    setActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/confirm`, {
        method: "POST",
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to confirm the report.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(buildStoredActionKey("confirmed", reportId), "true");
      }

      setConfirmedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
      setReports((current) =>
        current.map((report) =>
          report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
        ),
      );
      setToast({
        tone: "success",
        message: "Report confirmed. Thank you for helping the community.",
      });
    } catch (error) {
      console.error("Failed to confirm report.", error);
      setToast({
        tone: "error",
        message: "Unable to confirm this report right now.",
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResolveReport(reportId: string) {
    if (resolvedReportIds[reportId]) {
      return;
    }

    setActionLoadingId(reportId);

    try {
      const response = await fetch(`/api/reports/${reportId}/resolve`, {
        method: "POST",
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to update the report.");
      }

      if (typeof window !== "undefined") {
        localStorage.setItem(buildStoredActionKey("resolved", reportId), "true");
      }

      setResolvedReportIds((current) => ({
        ...current,
        [reportId]: true,
      }));
      setReports((current) =>
        current.map((report) =>
          report.id === reportId ? mapReportToIncident(payload.data as ReportRecord) : report,
        ),
      );
      setToast({
        tone: "success",
        message: "Marked as possibly resolved. Thank you for the update.",
      });
    } catch (error) {
      console.error("Failed to resolve report.", error);
      setToast({
        tone: "error",
        message: "Unable to update this report right now.",
      });
    } finally {
      setActionLoadingId(null);
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
      (position) => {
        updateFormState("latitude", position.coords.latitude.toFixed(6));
        updateFormState("longitude", position.coords.longitude.toFixed(6));
        setLoadingCurrentLocation(false);
      },
      () => {
        setLoadingCurrentLocation(false);
        setToast({
          tone: "error",
          message: "Unable to read your current location.",
        });
      },
    );
  }

  async function handleSubmitReport() {
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

    setSubmittingReport(true);

    try {
      const title = `${formState.category} at ${formState.locationName}`.slice(0, 120);
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description: formState.description.trim(),
          category: formState.category,
          severity: formState.severity,
          locationName: formState.locationName.trim(),
          latitude,
          longitude,
          reportedByName: formState.submitAnonymously
            ? undefined
            : formState.reportedByName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to submit report.");
      }

      setReports((current) => [mapReportToIncident(payload.data as ReportRecord), ...current]);
      setFormState(emptyFormState);
      setToast({
        tone: "success",
        message: "Community report submitted successfully.",
      });
    } catch (error) {
      console.error("Failed to submit report.", error);
      setToast({
        tone: "error",
        message: "Unable to submit your report right now.",
      });
    } finally {
      setSubmittingReport(false);
    }
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

          {toast ? (
            <div
              className={cn(
                "rounded-[14px] border px-4 py-3 text-[0.92rem]",
                toast.tone === "success"
                  ? "border-[rgba(34,197,94,0.28)] bg-[rgba(34,197,94,0.08)] text-[#166534]"
                  : "border-[rgba(239,68,68,0.28)] bg-[rgba(239,68,68,0.08)] text-[#991b1b]",
              )}
            >
              {toast.message}
            </div>
          ) : null}

          <section className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
              <div className="rounded-[14px] border border-[rgba(245,158,11,0.38)] bg-[rgba(245,158,11,0.08)] px-4 py-3 text-[0.94rem] text-[var(--color-foreground)]">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 text-[var(--color-warning)]" />
                  <p>
                    <span className="font-semibold">Safety First:</span> Do not enter flooded or dangerous areas to take photos. Your safety comes first.
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="text-[1.35rem] font-semibold text-[var(--color-foreground)]">
                  Location
                </h2>
                <div className="mt-3 flex flex-col gap-2.5 sm:flex-row">
                  <label className="flex h-10 flex-1 items-center gap-3 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 shadow-[var(--shadow-soft)]">
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
                    className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)] shadow-[var(--shadow-soft)]"
                  >
                    {loadingCurrentLocation ? (
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                    ) : (
                      <Phone className="h-4 w-4" />
                    )}
                    <span>Current Location</span>
                  </button>
                </div>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <input
                    type="text"
                    value={formState.latitude}
                    onChange={(event) => updateFormState("latitude", event.target.value)}
                    placeholder="Latitude"
                    className="h-10 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                  />
                  <input
                    type="text"
                    value={formState.longitude}
                    onChange={(event) => updateFormState("longitude", event.target.value)}
                    placeholder="Longitude"
                    className="h-10 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                  />
                </div>
                <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                  Provide a public location name and coordinates so the report can be shown on the live map.
                </p>
                <button
                  type="button"
                  className="mt-3 flex items-center gap-2 text-[0.9rem] font-medium text-[var(--color-primary)]"
                >
                  <MapIcon className="h-4 w-4" />
                  <span>Show interactive map</span>
                </button>
              </div>

              <div className="mt-8">
                <h2 className="text-[1.35rem] font-semibold text-[var(--color-foreground)]">
                  Incident Details
                </h2>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                      Incident Type
                    </div>
                    <SelectField
                      icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />}
                      value={formState.category}
                      onChange={(value) => updateFormState("category", value)}
                      options={INCIDENT_CATEGORY_OPTIONS}
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-1">
                    <div>
                      <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                        Severity Level
                      </div>
                      <SelectField
                        icon={<span className="h-3.5 w-3.5 rounded-full bg-[var(--color-warning)]" />}
                        value={formState.severity}
                        onChange={(value) => updateFormState("severity", value)}
                        options={REPORT_SEVERITIES}
                      />
                    </div>
                    <div>
                      <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                        Water Depth
                      </div>
                      <SelectField
                        icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />}
                        value={formState.waterDepth}
                        onChange={(value) => updateFormState("waterDepth", value)}
                        options={WATER_DEPTH_OPTIONS}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                    Description
                  </div>
                  <textarea
                    rows={3}
                    value={formState.description}
                    onChange={(event) => updateFormState("description", event.target.value)}
                    placeholder="Describe the current situation, affected areas, hazards, road conditions, and people needing assistance..."
                    className="w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                  />
                  <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                    Provide accurate and factual information to help your community stay informed.
                  </p>
                </div>

                <div className="mt-6">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-[0.92rem] font-medium text-[var(--color-foreground)]">
                      Upload Photos
                    </div>
                    <div className="text-[0.82rem] text-[var(--color-muted-foreground)]">
                      {formState.photos.length} / 6
                    </div>
                  </div>
                  <label className="mt-3 flex cursor-pointer flex-col rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-10 text-center">
                    <ImageUp className="mx-auto h-8 w-8 text-[var(--color-muted-foreground)]" />
                    <div className="mt-4 text-[0.98rem] font-medium text-[var(--color-foreground)]">
                      Drag & drop photos here
                    </div>
                    <div className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
                      or click to browse · PNG, JPG up to 6 files
                    </div>
                    <input
                      type="file"
                      multiple
                      accept="image/png,image/jpeg"
                      className="sr-only"
                      onChange={(event) =>
                        updateFormState(
                          "photos",
                          Array.from(event.target.files ?? []).slice(0, 6),
                        )
                      }
                    />
                  </label>
                  <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                    Photos are currently preview-only and are not yet stored with public reports.
                  </p>
                </div>
              </div>

              <div className="mt-6 border-t border-[var(--color-border)] pt-6">
                <h2 className="text-[1.35rem] font-semibold text-[var(--color-foreground)]">
                  Reporter Information
                </h2>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                      Reporter Name (Optional)
                    </div>
                    <input
                      type="text"
                      value={formState.reportedByName}
                      onChange={(event) => updateFormState("reportedByName", event.target.value)}
                      placeholder="Your name or organization"
                      className="h-10 w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                    />
                  </div>
                  <div>
                    <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                      Contact Number (Optional)
                    </div>
                    <input
                      type="text"
                      value={formState.contactNumber}
                      onChange={(event) => updateFormState("contactNumber", event.target.value)}
                      placeholder="09xx xxx xxxx"
                      className="h-10 w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-center gap-2 text-[0.9rem] text-[var(--color-foreground)]">
                  <input
                    type="checkbox"
                    checked={formState.submitAnonymously}
                    onChange={(event) =>
                      updateFormState("submitAnonymously", event.target.checked)
                    }
                    className="h-4 w-4 rounded border border-[var(--color-border)]"
                  />
                  <span>Submit Anonymously — Your information will be hidden from public view</span>
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  onClick={() => setFormState(emptyFormState)}
                  className="h-10 rounded-[11px] px-4 text-[0.92rem] font-medium text-[var(--color-foreground)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={handleSubmitReport}
                  disabled={submittingReport}
                  className="flex h-10 items-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.92rem] font-semibold text-white disabled:opacity-70"
                >
                  {submittingReport ? (
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  <span>Submit Report</span>
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-col gap-4">
              <div className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
                <div className="text-[0.82rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  COMMUNITY ACTIVITY
                </div>
                <div className="mt-4 space-y-3">
                  {activityStats.map((stat) => {
                    const Icon = stat.icon;
                    return (
                      <div key={stat.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 text-[0.94rem] text-[var(--color-foreground)]">
                          <Icon className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                          <span>{stat.label}</span>
                        </div>
                        <span className="text-[1.4rem] font-semibold text-[var(--color-foreground)]">
                          {stat.value}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 border-t border-[var(--color-border)] pt-3">
                  <div className="flex items-center gap-2 text-[0.84rem] text-[var(--color-muted-foreground)]">
                    <Flame className="h-4 w-4 text-[var(--color-warning)]" />
                    <span>Trending Areas:</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-[0.9rem] text-[var(--color-foreground)]">
                    {(trendingAreas.length > 0 ? trendingAreas : ["No active hotspots yet"]).map((area) => (
                      <li key={area}>• {area}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-[18px] border border-[var(--color-border)] bg-[rgba(37,99,235,0.06)] p-4 shadow-[var(--shadow-soft)]">
                <div className="text-[1rem] font-semibold text-[var(--color-primary)]">
                  Community-Powered Reports
                </div>
                <p className="mt-3 text-[0.9rem] leading-7 text-[var(--color-primary)]">
                  Reports are submitted by the public and may contain unverified information. Always follow official advisories from PAGASA, NDRRMC, LGUs, and emergency response agencies.
                </p>
              </div>

              <div className="min-h-0 flex-1 rounded-[18px] border border-[var(--color-border)] bg-transparent">
                <div className="px-1 pb-1 pt-3">
                  <div className="px-3 pb-3 pt-1 text-[0.82rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    ACTIVE REPORTS
                  </div>
                  {loadingReports ? (
                    <div className="flex h-40 items-center justify-center text-[var(--color-muted-foreground)]">
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="max-h-[320px] space-y-3 overflow-y-auto px-2 pb-3 sm:px-3">
                      {activeReports.map((report) => (
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
                      ))}
                    </div>
                  )}

                  <div className="px-3 pb-3 pt-4 text-[0.82rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    RECENTLY RESOLVED REPORTS
                  </div>
                  <div className="max-h-[220px] space-y-3 overflow-y-auto px-2 pb-3 sm:px-3">
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
                      <div className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.9rem] text-[var(--color-muted-foreground)]">
                        No recently resolved reports yet.
                      </div>
                    )}
                  </div>
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
    </>
  );
}
