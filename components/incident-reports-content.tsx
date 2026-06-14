"use client";

import { useEffect, useMemo, useState } from "react";
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
  formatCountLabel,
} from "@/lib/reporting";
import type { IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";
import { IncidentReportModal } from "@/components/incident-report-modal";
import type {
  ReportDetailResponse,
  ReportUpdateItem,
  ReportRecord,
  ReportsResponse,
} from "@/lib/report-types";
import { buildStoredActionKey, mapReportToIncident, severityBadgeClasses, severityLabels, getStatusPresentation } from "@/lib/report-ui";

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
  const thumbnailUrl = report.photos[0]?.imageUrl;

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
        <div className="flex min-w-0 flex-1 gap-3">
          {thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={thumbnailUrl}
              alt={report.title}
              className="h-16 w-16 shrink-0 rounded-[14px] object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="text-[0.98rem] font-semibold leading-7 text-[var(--color-foreground)]">
              {report.title}
            </div>
            <div className="mt-1 flex items-start gap-2 text-[0.86rem] text-[var(--color-muted-foreground)]">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0">{report.location}</span>
            </div>
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
  const selectedPhoto = formState.photos[0] ?? null;
  const photoPreviewUrl = useMemo(
    () => (selectedPhoto ? URL.createObjectURL(selectedPhoto) : null),
    [selectedPhoto],
  );

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

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

      const response = await fetch("/api/reports", {
        method: "POST",
        body: requestBody,
      });
      const payload = (await response.json()) as { data?: ReportRecord; error?: string };

      if (!response.ok || !payload.data) {
        throw new Error(payload.error ?? "Failed to submit report.");
      }

      setReports((current) => [mapReportToIncident(payload.data as ReportRecord), ...current]);
      setFormState(emptyFormState);
      setToast({
        tone: "success",
        message: selectedPhoto
          ? "Community report and photo submitted successfully."
          : "Community report submitted successfully.",
      });
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
                      Upload Photo
                    </div>
                    <div className="text-[0.82rem] text-[var(--color-muted-foreground)]">
                      {formState.photos.length} / 1
                    </div>
                  </div>
                  <label className="mt-3 flex cursor-pointer flex-col rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-10 text-center">
                    <ImageUp className="mx-auto h-8 w-8 text-[var(--color-muted-foreground)]" />
                    <div className="mt-4 text-[0.98rem] font-medium text-[var(--color-foreground)]">
                      Drag & drop a photo here
                    </div>
                    <div className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
                      or click to browse · JPG, PNG, WEBP up to 5 MB
                    </div>
                    <input
                      type="file"
                      accept={reportImageAcceptValue}
                      className="sr-only"
                      onChange={(event) => handlePhotoSelection(event.target.files)}
                    />
                  </label>
                  {formState.photos[0] ? (
                    <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
                      {photoPreviewUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={photoPreviewUrl}
                          alt={formState.photos[0].name}
                          className="h-16 w-16 rounded-[12px] object-cover"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <div className="truncate text-[0.9rem] font-medium text-[var(--color-foreground)]">
                          {formState.photos[0].name}
                        </div>
                        <div className="mt-1 text-[0.82rem] text-[var(--color-muted-foreground)]">
                          Photo ready to upload with this report.
                        </div>
                      </div>
                    </div>
                  ) : null}
                  <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                    Attach one optional image to help the community verify this report.
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
                  <span>{submittingReport ? "Uploading Report..." : "Submit Report"}</span>
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
