"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CloudRain,
  Clock3,
  FilePenLine,
  ImageUp,
  LoaderCircle,
  Navigation,
  Send,
  ShieldPlus,
  MapPin,
  ShieldAlert,
  ThumbsUp,
  Waves,
  X,
} from "lucide-react";

import {
  INCIDENT_CATEGORY_OPTIONS,
  REPORT_SEVERITIES,
  REPORT_STATUSES,
} from "@/lib/constants";
import { getReportImageAcceptValue, validateReportImageFile } from "@/lib/report-image-validation";
import { formatCountLabel, formatRelativeTime } from "@/lib/reporting";
import type { IncidentReport, WeatherLocationResult } from "@/lib/types";
import { cn } from "@/lib/utils";

import type { ReportUpdateItem } from "@/lib/report-types";
import {
  buildReportDirectionsUrl,
  buildReportEvacuationCentersHref,
  getReportActionLabel,
  isReportActionLoading,
  type ReportActionLoadingState,
} from "@/lib/report-actions";
import {
  getReportCommunitySignal,
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  getReportActivityLabel,
  getReportFreshnessBadge,
  getReportTrustDetail,
  getReportTrustSummary,
} from "@/lib/report-trust";
import { fetchWeatherLocation } from "@/lib/weather-client";

type IncidentReportModalProps = {
  report: IncidentReport | null;
  updates: ReportUpdateItem[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (reportId: string) => void;
  onResolve: (reportId: string) => void;
  onEditReport?: (report: IncidentReport, requestBody: FormData) => Promise<void>;
  onSubmitReportUpdate?: (report: IncidentReport, requestBody: FormData) => Promise<void>;
  onReportUpdate?: (report: IncidentReport) => void;
  onGetDirections?: (report: IncidentReport) => void;
  onFindEvacuationCenters?: (report: IncidentReport) => void;
  hasConfirmed: boolean;
  hasResolved: boolean;
  actionLoading: ReportActionLoadingState;
};

type EditReportFormState = {
  title: string;
  description: string;
  category: string;
  severity: string;
  locationName: string;
  latitude: string;
  longitude: string;
  image: File | null;
};

type ReportUpdateFormState = {
  message: string;
  severity: string;
  status: string;
  image: File | null;
};

const reportImageAcceptValue = getReportImageAcceptValue();
const editableStatusOptions = REPORT_STATUSES.filter((status) => status !== "Archived");

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

function ModalField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-[0.72rem] font-semibold text-[var(--color-muted-foreground)]">
        {label}
      </span>
      {children}
    </label>
  );
}

function modalInputClassName(extra = "") {
  return cn(
    "min-h-10 rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] px-3 text-[0.84rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] focus:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)]",
    extra,
  );
}

export function IncidentReportModal({
  report,
  updates,
  open,
  onOpenChange,
  onConfirm,
  onResolve,
  onEditReport,
  onSubmitReportUpdate,
  onReportUpdate,
  onGetDirections,
  onFindEvacuationCenters,
  hasConfirmed,
  hasResolved,
  actionLoading,
}: IncidentReportModalProps) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const [nearbyWeather, setNearbyWeather] = useState<WeatherLocationResult | null>(null);
  const [nearbyWeatherLoading, setNearbyWeatherLoading] = useState(false);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [updatePanelOpen, setUpdatePanelOpen] = useState(false);
  const [ownerActionError, setOwnerActionError] = useState("");
  const [savingOwnerAction, setSavingOwnerAction] = useState<"edit" | "update" | null>(null);
  const [editForm, setEditForm] = useState<EditReportFormState>({
    title: "",
    description: "",
    category: INCIDENT_CATEGORY_OPTIONS[0],
    severity: REPORT_SEVERITIES[1],
    locationName: "",
    latitude: "",
    longitude: "",
    image: null,
  });
  const [updateForm, setUpdateForm] = useState<ReportUpdateFormState>({
    message: "",
    severity: "",
    status: "",
    image: null,
  });
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const updateImageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !report?.coordinates) {
      return;
    }

    let isMounted = true;
    const abortController = new AbortController();
    const [latitude, longitude] = report.coordinates;
    const locationName = report.location;

    async function loadNearbyWeather() {
      setNearbyWeatherLoading(true);

      try {
        const result = await fetchWeatherLocation(
          {
            lat: latitude,
            lon: longitude,
            name: locationName,
          },
          abortController.signal,
        );

        if (isMounted) {
          setNearbyWeather(result);
        }
      } catch (error) {
        if (!isMounted || abortController.signal.aborted) {
          return;
        }

        console.error("Failed to load nearby weather for report.", error);
        setNearbyWeather(null);
      } finally {
        if (isMounted) {
          setNearbyWeatherLoading(false);
        }
      }
    }

    loadNearbyWeather();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [open, report]);

  useEffect(() => {
    if (!open || !report) {
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      const [latitude, longitude] = report.coordinates ?? [0, 0];

      setPhotoIndex(0);
      setEditPanelOpen(false);
      setUpdatePanelOpen(false);
      setOwnerActionError("");
      setSavingOwnerAction(null);
      setEditForm({
        title: report.title,
        description: report.description,
        category: report.categoryValue,
        severity: report.severityValue,
        locationName: report.location,
        latitude: String(latitude),
        longitude: String(longitude),
        image: null,
      });
      setUpdateForm({
        message: "",
        severity: "",
        status: "",
        image: null,
      });
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [open, report]);

  function handleEditImageSelection(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;

    if (!file) {
      setEditForm((current) => ({ ...current, image: null }));
      return;
    }

    const imageValidationError = validateReportImageFile(file);

    if (imageValidationError) {
      setOwnerActionError(imageValidationError);
      setEditForm((current) => ({ ...current, image: null }));
      return;
    }

    setOwnerActionError("");
    setEditForm((current) => ({ ...current, image: file }));
  }

  function handleUpdateImageSelection(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;

    if (!file) {
      setUpdateForm((current) => ({ ...current, image: null }));
      return;
    }

    const imageValidationError = validateReportImageFile(file);

    if (imageValidationError) {
      setOwnerActionError(imageValidationError);
      setUpdateForm((current) => ({ ...current, image: null }));
      return;
    }

    setOwnerActionError("");
    setUpdateForm((current) => ({ ...current, image: file }));
  }

  async function handleEditSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!report || !onEditReport) {
      return;
    }

    const requestBody = new FormData();
    requestBody.set("title", editForm.title.trim());
    requestBody.set("description", editForm.description.trim());
    requestBody.set("category", editForm.category);
    requestBody.set("severity", editForm.severity);
    requestBody.set("locationName", editForm.locationName.trim());
    requestBody.set("latitude", editForm.latitude.trim());
    requestBody.set("longitude", editForm.longitude.trim());

    if (editForm.image) {
      requestBody.set("image", editForm.image);
    }

    setSavingOwnerAction("edit");
    setOwnerActionError("");

    try {
      await onEditReport(report, requestBody);
      setEditPanelOpen(false);
      setEditForm((current) => ({ ...current, image: null }));
      if (editImageInputRef.current) {
        editImageInputRef.current.value = "";
      }
    } catch (error) {
      setOwnerActionError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to update this report.",
      );
    } finally {
      setSavingOwnerAction(null);
    }
  }

  async function handleUpdateSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!report || !onSubmitReportUpdate) {
      return;
    }

    const requestBody = new FormData();
    requestBody.set("message", updateForm.message.trim());

    if (updateForm.severity) {
      requestBody.set("severity", updateForm.severity);
    }

    if (updateForm.status) {
      requestBody.set("status", updateForm.status);
    }

    if (updateForm.image) {
      requestBody.set("image", updateForm.image);
    }

    setSavingOwnerAction("update");
    setOwnerActionError("");

    try {
      await onSubmitReportUpdate(report, requestBody);
      setUpdatePanelOpen(false);
      setUpdateForm({
        message: "",
        severity: "",
        status: "",
        image: null,
      });
      if (updateImageInputRef.current) {
        updateImageInputRef.current.value = "";
      }
    } catch (error) {
      setOwnerActionError(
        error instanceof Error && error.message
          ? error.message
          : "Unable to submit this update.",
      );
    } finally {
      setSavingOwnerAction(null);
    }
  }

  if (!open || !report) {
    return null;
  }

  const photos = report.photos;
  const currentPhoto = photos[photoIndex] ?? photos[0] ?? null;
  const statusPresentation = getStatusPresentation(report.status);
  const isResolved = report.status === "Resolved";
  const confirmLoading = isReportActionLoading(actionLoading, report.id, "confirmed");
  const resolveLoading = isReportActionLoading(actionLoading, report.id, "resolved");
  const actionBusy = isReportActionLoading(actionLoading, report.id);
  const confirmDisabled = actionBusy || hasConfirmed || isResolved;
  const resolveDisabled = actionBusy || hasResolved || isResolved;
  const directionsUrl = buildReportDirectionsUrl(report);
  const evacuationCentersHref = buildReportEvacuationCentersHref(report);
  const communitySignal = getReportCommunitySignal(report);
  const freshnessBadge = getReportFreshnessBadge(report);
  const activityLabel = getReportActivityLabel(report);
  const trustSummary = getReportTrustSummary(report);
  const trustDetail = getReportTrustDetail(report);
  const sourceBadgeClasses =
    report.sourceCategory === "official"
      ? "border-[var(--color-info-border)] bg-[var(--color-info-surface)] text-[var(--color-info-text)]"
      : report.sourceCategory === "system"
        ? "border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] text-[var(--color-warning-text)]"
        : "border-[var(--color-muted-border)] bg-[var(--color-muted-surface)] text-[var(--color-muted-text)]";
  const footerButtonBase =
    "inline-flex min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-[11px] px-3 text-center text-[0.78rem] font-semibold leading-none whitespace-nowrap transition-colors md:min-h-10 md:px-3.5 md:text-[0.82rem]";
  const secondaryButtonClassName =
    "border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_84%,transparent)] text-[var(--color-foreground)] hover:border-[color:color-mix(in_srgb,var(--color-primary)_42%,transparent)] hover:text-[var(--color-primary)]";
  const disabledButtonClassName =
    "cursor-not-allowed border border-[var(--color-disabled-border)] bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]";

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-modal-backdrop)] backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />
      <div className="fixed inset-0 z-[var(--layer-modal)] flex items-end justify-center p-0 sm:p-4 md:items-center">
        <div className="relative flex max-h-[92dvh] w-full max-w-[680px] flex-col overflow-hidden rounded-t-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-floating)] md:max-h-[94vh] md:rounded-[18px]">
          <button
            type="button"
            aria-label="Close report details"
            onClick={() => onOpenChange(false)}
            className="absolute right-2.5 top-2.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-700/85 text-white md:right-3 md:top-3 md:h-9 md:w-9"
          >
            <X className="h-4 w-4" />
          </button>

          {currentPhoto?.imageUrl ? (
            <div className="relative h-[160px] overflow-hidden bg-[var(--color-panel)] md:aspect-[16/8.4] md:h-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={currentPhoto.imageUrl}
                alt={currentPhoto.label}
                className="h-full w-full object-cover"
              />

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
          ) : null}

          <div className="flex-1 overflow-y-auto px-3 pb-5 pt-3 md:px-5 md:pb-6 md:pt-4">
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
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2 py-0.75 text-[0.66rem] font-medium md:px-2.5 md:py-1 md:text-[0.74rem]",
                  sourceBadgeClasses,
                )}
              >
                {report.sourceLabel}
              </span>
              {freshnessBadge ? (
                <span
                  className={cn(
                    "rounded-full px-2 py-0.75 text-[0.66rem] font-medium md:px-2.5 md:py-1 md:text-[0.74rem]",
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
                value={activityLabel}
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

            <div className="mt-3 rounded-[12px] bg-[var(--color-muted-surface)] px-3 py-2 text-[0.78rem] leading-5 text-[var(--color-muted-text)] md:mt-4 md:rounded-[14px] md:border md:border-[var(--color-muted-border)] md:px-3.5 md:py-3">
              <div className="text-[0.68rem] font-semibold text-[var(--color-muted-foreground)] md:text-[0.74rem]">
                Trust and freshness
              </div>
              <p className="mt-1 text-[0.78rem] leading-5 text-[var(--color-foreground)] md:text-[0.86rem] md:leading-6">
                {trustSummary}
              </p>
              <p className="mt-1 text-[0.74rem] leading-5 text-[var(--color-muted-foreground)] md:text-[0.82rem]">
                {trustDetail}
              </p>
              <p className="mt-1 text-[0.74rem] leading-5 text-[var(--color-muted-foreground)] md:text-[0.82rem]">
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
              <span>{report.sourceLabel}</span>
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
                  {report.sourceLabel}
                </div>
              </div>
            </div>

            {report.officialSource?.officialSummary ||
            report.officialSource?.officialSourceUrl ||
            report.officialSource?.officialIssuedAt ? (
              <div className="mt-3 rounded-[12px] border border-[var(--color-info-border)] bg-[var(--color-info-surface)] px-3 py-2 text-[0.76rem] text-[var(--color-foreground)] md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3 md:text-[0.84rem]">
                <div className="text-[0.68rem] font-semibold text-[var(--color-info-text)] md:text-[0.74rem]">
                  Official source metadata
                </div>
                {report.officialSource?.officialSummary ? (
                  <p className="mt-1">{report.officialSource.officialSummary}</p>
                ) : null}
                <div className="mt-1 space-y-1 text-[var(--color-muted-foreground)]">
                  {report.officialSource?.officialArea ? <div>Area: {report.officialSource.officialArea}</div> : null}
                  {report.officialSource?.officialIssuedAt ? <div>Issued: {report.officialSource.officialIssuedAt}</div> : null}
                  {report.officialSource?.officialValidUntil ? <div>Valid until: {report.officialSource.officialValidUntil}</div> : null}
                  {report.officialSource?.officialSourceUrl ? (
                    <a
                      href={report.officialSource.officialSourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex text-[var(--color-info-text)] underline underline-offset-2"
                    >
                      View official source
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}

            {nearbyWeatherLoading ? (
              <div className="mt-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-[0.76rem] text-[var(--color-muted-foreground)] md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3 md:text-[0.84rem]">
                Loading nearby weather...
              </div>
            ) : nearbyWeather ? (
              <div className="mt-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-[0.76rem] md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3 md:text-[0.84rem]">
                <div className="flex items-center gap-2 text-[var(--color-foreground)]">
                  <CloudRain className="h-4 w-4 text-[var(--color-primary)]" />
                  <span className="font-semibold">Nearby weather</span>
                </div>
                <p className="mt-1 text-[var(--color-foreground)]">
                  {nearbyWeather.location.condition ?? "Weather conditions unavailable"} ·{" "}
                  {nearbyWeather.location.precipitation === null
                    ? "Precipitation unavailable"
                    : `${nearbyWeather.location.precipitation.toFixed(1)} mm/hr`} · Source:{" "}
                  {nearbyWeather.location.source.name}
                </p>
                <p className="mt-1 text-[var(--color-muted-foreground)]">
                  {nearbyWeather.advisoryMessage}
                </p>
              </div>
            ) : null}

            {report.resolvedAgo ? (
              <div className="mt-3 rounded-[12px] border border-[var(--color-muted-border)] bg-[var(--color-muted-surface)] px-3 py-2 text-[0.76rem] text-[var(--color-foreground)] md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3 md:text-[0.84rem]">
                {report.resolvedAgo}
              </div>
            ) : null}

            <div className="mt-3 rounded-[12px] border border-[var(--color-warning-border)] bg-[var(--color-warning-surface)] px-3 py-2 md:mt-4 md:rounded-[14px] md:px-3.5 md:py-3">
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
                      {update.imageUrl ? (
                        <div className="mt-2 overflow-hidden rounded-[10px] border border-[var(--color-border)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={update.imageUrl}
                            alt="Report update"
                            className="max-h-48 w-full object-cover"
                          />
                        </div>
                      ) : null}
                      {update.severity || update.status ? (
                        <div className="mt-2 flex flex-wrap gap-1.5 text-[0.7rem] font-medium text-[var(--color-muted-foreground)]">
                          {update.severity ? (
                            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5">
                              Severity: {update.severity}
                            </span>
                          ) : null}
                          {update.status ? (
                            <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5">
                              Status: {update.status}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                      <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)] md:text-[0.76rem]">
                        {formatRelativeTime(update.createdAt)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {report.isOwner && (onEditReport || onSubmitReportUpdate) ? (
              <div className="mt-3 border-t border-[var(--color-border)] pt-3 md:mt-4 md:pt-4">
                <div className="text-[0.68rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)] md:text-[0.74rem]">
                  Owner actions
                </div>

                {ownerActionError ? (
                  <div className="mt-2 rounded-[10px] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-3 py-2 text-[0.78rem] text-[var(--color-danger-text)]">
                    {ownerActionError}
                  </div>
                ) : null}

                {editPanelOpen && onEditReport ? (
                  <form
                    onSubmit={handleEditSubmit}
                    className="mt-2 grid gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3 md:mt-3 md:px-3.5"
                  >
                    <div className="grid gap-3 md:grid-cols-2">
                      <ModalField label="Title">
                        <input
                          value={editForm.title}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, title: event.target.value }))
                          }
                          className={modalInputClassName()}
                        />
                      </ModalField>
                      <ModalField label="Location">
                        <input
                          value={editForm.locationName}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              locationName: event.target.value,
                            }))
                          }
                          className={modalInputClassName()}
                        />
                      </ModalField>
                      <ModalField label="Category">
                        <select
                          value={editForm.category}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, category: event.target.value }))
                          }
                          className={modalInputClassName()}
                        >
                          {INCIDENT_CATEGORY_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                      <ModalField label="Severity">
                        <select
                          value={editForm.severity}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, severity: event.target.value }))
                          }
                          className={modalInputClassName()}
                        >
                          {REPORT_SEVERITIES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                      <ModalField label="Latitude">
                        <input
                          value={editForm.latitude}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, latitude: event.target.value }))
                          }
                          className={modalInputClassName("tabular-nums")}
                        />
                      </ModalField>
                      <ModalField label="Longitude">
                        <input
                          value={editForm.longitude}
                          onChange={(event) =>
                            setEditForm((current) => ({
                              ...current,
                              longitude: event.target.value,
                            }))
                          }
                          className={modalInputClassName("tabular-nums")}
                        />
                      </ModalField>
                    </div>
                    <ModalField label="Description">
                      <textarea
                        rows={4}
                        value={editForm.description}
                        onChange={(event) =>
                          setEditForm((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        className={modalInputClassName("py-2.5 leading-5")}
                      />
                    </ModalField>
                    <div className="grid gap-2">
                      <input
                        ref={editImageInputRef}
                        type="file"
                        accept={reportImageAcceptValue}
                        className="sr-only"
                        onChange={(event) => handleEditImageSelection(event.target.files)}
                      />
                      <button
                        type="button"
                        onClick={() => editImageInputRef.current?.click()}
                        className={cn(footerButtonBase, secondaryButtonClassName)}
                      >
                        <ImageUp className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {editForm.image ? editForm.image.name : "Replace image"}
                        </span>
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="submit"
                        disabled={savingOwnerAction !== null}
                        className={cn(
                          footerButtonBase,
                          savingOwnerAction ? disabledButtonClassName : "floodwatch-primary-action",
                        )}
                      >
                        {savingOwnerAction === "edit" ? (
                          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <FilePenLine className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">
                          {savingOwnerAction === "edit" ? "Saving..." : "Save edit"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditPanelOpen(false)}
                        disabled={savingOwnerAction !== null}
                        className={cn(footerButtonBase, secondaryButtonClassName)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}

                {updatePanelOpen && onSubmitReportUpdate ? (
                  <form
                    onSubmit={handleUpdateSubmit}
                    className="mt-2 grid gap-3 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3 md:mt-3 md:px-3.5"
                  >
                    <ModalField label="Update note">
                      <textarea
                        rows={4}
                        value={updateForm.message}
                        onChange={(event) =>
                          setUpdateForm((current) => ({
                            ...current,
                            message: event.target.value,
                          }))
                        }
                        placeholder="Add a factual update about current conditions."
                        className={modalInputClassName("py-2.5 leading-5")}
                      />
                    </ModalField>
                    <div className="grid gap-3 md:grid-cols-2">
                      <ModalField label="Severity">
                        <select
                          value={updateForm.severity}
                          onChange={(event) =>
                            setUpdateForm((current) => ({
                              ...current,
                              severity: event.target.value,
                            }))
                          }
                          className={modalInputClassName()}
                        >
                          <option value="">No severity change</option>
                          {REPORT_SEVERITIES.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                      <ModalField label="Status">
                        <select
                          value={updateForm.status}
                          onChange={(event) =>
                            setUpdateForm((current) => ({
                              ...current,
                              status: event.target.value,
                            }))
                          }
                          className={modalInputClassName()}
                        >
                          <option value="">No status change</option>
                          {editableStatusOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      </ModalField>
                    </div>
                    <input
                      ref={updateImageInputRef}
                      type="file"
                      accept={reportImageAcceptValue}
                      className="sr-only"
                      onChange={(event) => handleUpdateImageSelection(event.target.files)}
                    />
                    <button
                      type="button"
                      onClick={() => updateImageInputRef.current?.click()}
                      className={cn(footerButtonBase, secondaryButtonClassName)}
                    >
                      <ImageUp className="h-4 w-4 shrink-0" />
                      <span className="truncate">
                        {updateForm.image ? updateForm.image.name : "Attach image"}
                      </span>
                    </button>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="submit"
                        disabled={savingOwnerAction !== null}
                        className={cn(
                          footerButtonBase,
                          savingOwnerAction ? disabledButtonClassName : "floodwatch-primary-action",
                        )}
                      >
                        {savingOwnerAction === "update" ? (
                          <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 shrink-0" />
                        )}
                        <span className="truncate">
                          {savingOwnerAction === "update" ? "Submitting..." : "Submit update"}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setUpdatePanelOpen(false)}
                        disabled={savingOwnerAction !== null}
                        className={cn(footerButtonBase, secondaryButtonClassName)}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-sidebar)_96%,transparent)] px-3 py-3 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur-md md:px-5">
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-label="Confirm this flood report"
                  onClick={() => onConfirm(report.id)}
                  disabled={confirmDisabled}
                  className={cn(
                    footerButtonBase,
                    confirmDisabled
                      ? "bg-[var(--color-disabled-surface)] text-[var(--color-disabled-text)]"
                      : "floodwatch-primary-action",
                  )}
                >
                  <ThumbsUp className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {getReportActionLabel({
                      type: "confirmed",
                      loading: confirmLoading,
                      alreadySubmitted: hasConfirmed,
                      compact: true,
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Mark water as receded for this report"
                  onClick={() => onResolve(report.id)}
                  disabled={resolveDisabled}
                  className={cn(
                    footerButtonBase,
                    resolveDisabled ? disabledButtonClassName : secondaryButtonClassName,
                  )}
                >
                  <Check className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {getReportActionLabel({
                      type: "resolved",
                      loading: resolveLoading,
                      alreadySubmitted: hasResolved,
                      compact: true,
                    })}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {report.isOwner && onEditReport ? (
                  <button
                    type="button"
                    aria-label="Edit this report"
                    onClick={() => {
                      setEditPanelOpen((current) => !current);
                      setUpdatePanelOpen(false);
                      setOwnerActionError("");
                    }}
                    disabled={savingOwnerAction !== null}
                    className={cn(
                      footerButtonBase,
                      savingOwnerAction ? disabledButtonClassName : secondaryButtonClassName,
                    )}
                  >
                    <FilePenLine className="h-4 w-4 shrink-0" />
                    <span className="truncate">Edit</span>
                  </button>
                ) : null}
                {report.isOwner && onSubmitReportUpdate ? (
                  <button
                    type="button"
                    aria-label="Submit an update for this report"
                    onClick={() => {
                      setUpdatePanelOpen((current) => !current);
                      setEditPanelOpen(false);
                      setOwnerActionError("");
                    }}
                    disabled={savingOwnerAction !== null}
                    className={cn(
                      footerButtonBase,
                      savingOwnerAction ? disabledButtonClassName : secondaryButtonClassName,
                    )}
                  >
                    <Send className="h-4 w-4 shrink-0" />
                    <span className="truncate">Update</span>
                  </button>
                ) : onReportUpdate && report.isOwner ? (
                  <button
                    type="button"
                    aria-label="Submit an update for this report"
                    onClick={() => onReportUpdate(report)}
                    className={cn(footerButtonBase, secondaryButtonClassName)}
                  >
                    <FilePenLine className="h-4 w-4 shrink-0" />
                    <span className="truncate">Update</span>
                  </button>
                ) : null}
                {directionsUrl && onGetDirections ? (
                  <button
                    type="button"
                    aria-label="Get directions to this report"
                    onClick={() => onGetDirections(report)}
                    className={cn(footerButtonBase, secondaryButtonClassName)}
                  >
                    <Navigation className="h-4 w-4 shrink-0" />
                    <span className="truncate">Directions</span>
                  </button>
                ) : null}
                {evacuationCentersHref && onFindEvacuationCenters ? (
                  <button
                    type="button"
                    aria-label="Find evacuation centers near this report"
                    onClick={() => onFindEvacuationCenters(report)}
                    className={cn(footerButtonBase, secondaryButtonClassName)}
                  >
                    <ShieldPlus className="h-4 w-4 shrink-0" />
                    <span className="truncate">Centers</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  className={cn(
                    footerButtonBase,
                    "border border-transparent bg-transparent text-[var(--color-muted-foreground)] hover:bg-[var(--color-muted-surface)] hover:text-[var(--color-foreground)]",
                  )}
                >
                  <span className="truncate">Close</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
