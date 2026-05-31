"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Eye,
  Flame,
  ImageUp,
  Map,
  MapPin,
  Phone,
  Send,
  ThumbsUp,
  Waves,
  X,
} from "lucide-react";

import {
  COMMUNITY_ACTIVITY_STATS,
  INCIDENT_REPORTS,
  TRENDING_AREAS,
} from "@/lib/constants";
import type { AlertSeverity, IncidentReport } from "@/lib/types";
import { cn } from "@/lib/utils";

const severityBadgeClasses: Record<AlertSeverity, string> = {
  safe: "border-[rgba(34,197,94,0.34)] bg-[rgba(34,197,94,0.08)] text-[var(--color-success)]",
  moderate:
    "border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] text-[var(--color-warning)]",
  high: "border-[rgba(249,115,22,0.34)] bg-[rgba(249,115,22,0.08)] text-[var(--color-high)]",
  severe:
    "border-[rgba(239,68,68,0.34)] bg-[rgba(239,68,68,0.08)] text-[var(--color-danger)]",
};

const severityLabels: Record<AlertSeverity, string> = {
  safe: "Safe",
  moderate: "Moderate Risk",
  high: "High Risk",
  severe: "Severe Flooding",
};

function SelectField({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <button
      type="button"
      className="flex h-10 items-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] text-[var(--color-foreground)] shadow-[var(--shadow-soft)]"
    >
      {icon}
      <span>{value}</span>
      <ChevronDown className="ml-auto h-4 w-4 text-[var(--color-muted-foreground)]" />
    </button>
  );
}

function IncidentReportModal({
  report,
  open,
  onOpenChange,
}: {
  report: IncidentReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [photoIndex, setPhotoIndex] = useState(0);

  const currentReport = report;

  if (!open || !currentReport) {
    return null;
  }

  const photos = currentReport.photos;
  const currentPhoto = photos[photoIndex] ?? photos[0];

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
            <div className="absolute inset-0 flex items-center justify-center text-[1.1rem] font-medium text-[var(--color-muted-foreground)]">
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
                    setPhotoIndex((current) => (current === 0 ? photos.length - 1 : current - 1))
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
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-slate-700/82 px-3 py-1 text-[0.82rem] font-semibold text-white">
                  {photoIndex + 1}/{photos.length}
                </div>
              </>
            ) : null}
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-[1.45rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
                    {currentReport.location}
                  </h2>
                  <span
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold",
                      severityBadgeClasses[currentReport.severity],
                    )}
                  >
                    {severityLabels[currentReport.severity]}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-[0.92rem] text-[var(--color-muted-foreground)]">
                  <MapPin className="h-4 w-4" />
                  <span>{currentReport.coordinatesLabel}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <div className="flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                <Waves className="h-4 w-4 text-[var(--color-primary)]" />
                <span>{currentReport.category}</span>
              </div>
              {currentReport.waterLevel ? (
                <div className="mt-3 text-[1rem] font-medium text-[var(--color-muted-foreground)]">
                  Water Level:{" "}
                  <span className="text-[var(--color-foreground)]">
                    {currentReport.waterLevel}
                  </span>
                </div>
              ) : null}
              {currentReport.note ? (
                <div className="mt-3 text-[1rem] font-medium text-[var(--color-foreground)]">
                  {currentReport.note}
                </div>
              ) : null}
            </div>

            <div className="mt-5">
              <h3 className="text-[1.02rem] font-semibold text-[var(--color-foreground)]">
                Description
              </h3>
              <p className="mt-2 text-[0.95rem] leading-8 text-[var(--color-muted-foreground)]">
                {currentReport.description}
              </p>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--color-border)] pt-4">
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  REPORTED
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <Clock3 className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{currentReport.reportedAgo}</span>
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  STATUS
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[#22c55e]">
                  <span className="h-3 w-3 rounded-full bg-[#22c55e]" />
                  <span>{currentReport.status}</span>
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  CONFIRMATIONS
                </div>
                <div className="mt-1.5 flex items-center gap-2 text-[0.95rem] text-[var(--color-foreground)]">
                  <ThumbsUp className="h-4 w-4 text-[var(--color-muted-foreground)]" />
                  <span>{currentReport.confirmations} users</span>
                </div>
              </div>
              <div>
                <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  REPORTER
                </div>
                <div className="mt-1.5 text-[0.95rem] text-[var(--color-foreground)]">
                  {currentReport.reporter}
                </div>
              </div>
            </div>

            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <div className="text-[0.78rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                PHOTOS
              </div>
              <div className="mt-3 flex gap-2.5">
                {photos.map((photo, index) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => setPhotoIndex(index)}
                    className={cn(
                      "overflow-hidden rounded-[12px] border p-0",
                      index === photoIndex
                        ? "border-[var(--color-primary)]"
                        : "border-[var(--color-border)]",
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-[58px] w-[58px] items-center justify-center bg-gradient-to-br text-[0.75rem] text-[var(--color-muted-foreground)]",
                        photo.accent,
                      )}
                    >
                      {index + 1}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-5 py-4">
            <button
              type="button"
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-4 text-[0.95rem] font-semibold text-white"
            >
              <ThumbsUp className="h-4 w-4" />
              <span>Confirm Report</span>
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
}: {
  report: IncidentReport;
  onView: (report: IncidentReport) => void;
}) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[0.98rem] font-semibold text-[var(--color-foreground)]">
            <MapPin className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
            <span>{report.location}</span>
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold",
            severityBadgeClasses[report.severity],
          )}
        >
          {severityLabels[report.severity]}
        </span>
      </div>

      <div className="mt-3 text-[0.88rem] text-[var(--color-muted-foreground)]">
        {report.category}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.86rem] text-[#22c55e]">
        <span className="h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
        <span>{report.status}</span>
      </div>

      <div className="mt-3 rounded-[12px] bg-[var(--color-panel)] px-3 py-2.5 text-[0.86rem] text-[var(--color-foreground)]">
        Confirmed by {report.confirmations} users
      </div>

      <div className="mt-3 flex items-center justify-between gap-3 text-[0.82rem] text-[var(--color-muted-foreground)]">
        <div className="flex items-center gap-1.5">
          <Clock3 className="h-3.5 w-3.5" />
          <span>{report.reportedAgo}</span>
        </div>
        <span>{report.sourceUnit}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <button
          type="button"
          onClick={() => onView(report)}
          className="flex h-9 items-center justify-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[0.86rem] font-medium text-[var(--color-foreground)]"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>View</span>
        </button>
        <button
          type="button"
          className="flex h-9 items-center justify-center gap-2 rounded-[10px] text-[0.86rem] font-medium text-[var(--color-foreground)]"
        >
          <ThumbsUp className="h-3.5 w-3.5" />
          <span>Confirm</span>
        </button>
      </div>
    </article>
  );
}

export function IncidentReportsContent() {
  const [selectedReport, setSelectedReport] = useState<IncidentReport | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const activityStats = useMemo(() => COMMUNITY_ACTIVITY_STATS, []);

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

          <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
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
                      placeholder="Street, barangay, city or coordinates"
                      className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
                    />
                  </label>
                  <button
                    type="button"
                    className="flex h-10 items-center justify-center gap-2 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)] shadow-[var(--shadow-soft)]"
                  >
                    <Phone className="h-4 w-4" />
                    <span>Current Location</span>
                  </button>
                </div>
                <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                  Enter a street address, barangay, city, or GPS coordinates. You can also search for a location.
                </p>
                <button
                  type="button"
                  className="mt-3 flex items-center gap-2 text-[0.9rem] font-medium text-[var(--color-primary)]"
                >
                  <Map className="h-4 w-4" />
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
                    <SelectField icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />} value="Flooding" />
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:col-span-1">
                    <div>
                      <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                        Severity Level
                      </div>
                      <SelectField icon={<span className="h-3.5 w-3.5 rounded-full bg-[var(--color-warning)]" />} value="Moderate" />
                    </div>
                    <div>
                      <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                        Water Depth
                      </div>
                      <SelectField icon={<Waves className="h-4 w-4 text-[var(--color-primary)]" />} value="Knee Deep" />
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <div className="mb-2 text-[0.92rem] font-medium text-[var(--color-foreground)]">
                    Description
                  </div>
                  <textarea
                    rows={3}
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
                    <div className="text-[0.82rem] text-[var(--color-muted-foreground)]">0 / 6</div>
                  </div>
                  <div className="mt-3 rounded-[14px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-6 py-10 text-center">
                    <ImageUp className="mx-auto h-8 w-8 text-[var(--color-muted-foreground)]" />
                    <div className="mt-4 text-[0.98rem] font-medium text-[var(--color-foreground)]">
                      Drag & drop photos here
                    </div>
                    <div className="mt-1 text-[0.84rem] text-[var(--color-muted-foreground)]">
                      or click to browse · PNG, JPG up to 6 files
                    </div>
                  </div>
                  <p className="mt-2 text-[0.82rem] text-[var(--color-muted-foreground)]">
                    Photos help improve report accuracy and community verification.
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
                      placeholder="09xx xxx xxxx"
                      className="h-10 w-full rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)] shadow-[var(--shadow-soft)]"
                    />
                  </div>
                </div>

                <label className="mt-4 flex items-center gap-2 text-[0.9rem] text-[var(--color-foreground)]">
                  <input type="checkbox" className="h-4 w-4 rounded border border-[var(--color-border)]" />
                  <span>Submit Anonymously — Your information will be hidden from public view</span>
                </label>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3 border-t border-[var(--color-border)] pt-4">
                <button
                  type="button"
                  className="h-10 rounded-[11px] px-4 text-[0.92rem] font-medium text-[var(--color-foreground)]"
                >
                  Clear
                </button>
                <button
                  type="button"
                  className="flex h-10 items-center gap-2 rounded-[11px] bg-[var(--color-primary)] px-4 text-[0.92rem] font-semibold text-white"
                >
                  <Send className="h-4 w-4" />
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
                    {TRENDING_AREAS.map((area) => (
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
                <div className="px-1 pb-1 pt-0">
                  <div className="px-3 pb-3 pt-1 text-[0.82rem] font-semibold tracking-[0.06em] text-[var(--color-muted-foreground)]">
                    RECENT REPORTS
                  </div>
                  <div className="max-h-[520px] space-y-3 overflow-y-auto px-3 pb-3">
                    {INCIDENT_REPORTS.map((report) => (
                      <ReportCard
                        key={report.id}
                        report={report}
                        onView={(nextReport) => {
                          setSelectedReport(nextReport);
                          setModalOpen(true);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="h-20 md:hidden" />
        </div>
      </div>

      <IncidentReportModal
        report={selectedReport}
        open={modalOpen}
        onOpenChange={(open) => {
          setModalOpen(open);
          if (!open) {
            setSelectedReport(null);
          }
        }}
      />
    </>
  );
}
