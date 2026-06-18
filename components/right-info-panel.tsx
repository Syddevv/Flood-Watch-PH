import type { ReactNode } from "react";
import { Check, Clock3, Info, ThumbsUp } from "lucide-react";

import { AlertCard } from "@/components/alert-card";
import { EmergencyHotlineCard } from "@/components/emergency-hotline-card";
import { EvacuationCenterCard } from "@/components/evacuation-center-card";
import { WeatherOverview } from "@/components/weather-overview";
import { formatCountLabel } from "@/lib/reporting";
import {
  getReportCommunitySignal,
  getStatusPresentation,
  severityBadgeClasses,
  severityLabels,
} from "@/lib/report-ui";
import {
  getReportActivityLabel,
  getReportFreshnessBadge,
  getReportTrustSummary,
} from "@/lib/report-trust";
import type {
  EmergencyHotline,
  EvacuationCenter,
  FloodAlert,
  IncidentReport,
  WeatherOverviewData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type RightInfoPanelProps = {
  alerts: FloodAlert[];
  weather: WeatherOverviewData;
  weatherLoading?: boolean;
  weatherError?: string | null;
  alertsLoading?: boolean;
  alertsError?: string | null;
  centers: EvacuationCenter[];
  hotlines: EmergencyHotline[];
  hotlineNotice: string;
  timestamp: string;
  officialAlertsTitle?: string;
  showCommunityReportsSection?: boolean;
  communityReports?: IncidentReport[];
  communityReportsLoading?: boolean;
  communityReportsError?: string | null;
  onViewCommunityReport?: (reportId: string) => void;
  communityReportsDisclaimer?: string;
  className?: string;
};

function CommunityReportPanelItem({
  report,
  onView,
}: {
  report: IncidentReport;
  onView?: (reportId: string) => void;
}) {
  const statusPresentation = getStatusPresentation(report.status);
  const thumbnailUrl = report.photos[0]?.imageUrl;
  const freshnessBadge = getReportFreshnessBadge(report);
  const activityLabel = getReportActivityLabel(report);

  return (
    <article className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3 py-2.5">
      <div className="grid grid-cols-[40px_minmax(0,1fr)] gap-2.5">
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
                "rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold",
                severityBadgeClasses[report.severity],
              )}
            >
              {severityLabels[report.severity]}
            </span>
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.66rem] font-medium",
                statusPresentation.textClassName,
                statusPresentation.wrapperClassName,
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", statusPresentation.dotClassName)} />
              <span>{statusPresentation.label}</span>
            </span>
            {freshnessBadge ? (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[0.66rem] font-medium",
                  freshnessBadge.tone === "success"
                    ? "bg-[rgba(34,197,94,0.12)] text-[#15803d]"
                    : freshnessBadge.tone === "warning"
                      ? "bg-[rgba(245,158,11,0.12)] text-[#b45309]"
                      : freshnessBadge.tone === "muted"
                        ? "bg-[rgba(148,163,184,0.14)] text-[#475569]"
                        : "bg-[rgba(37,99,235,0.12)] text-[#1d4ed8]",
                )}
              >
                {freshnessBadge.label}
              </span>
            ) : null}
          </div>

          <div className="mt-1 truncate text-[0.92rem] font-semibold text-[var(--color-foreground)]">
            {report.title}
          </div>
          <div className="mt-0.5 truncate text-[0.76rem] text-[var(--color-muted-foreground)]">
            {report.location}
          </div>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="inline-flex items-center gap-1.25 whitespace-nowrap">
            <Clock3 className="h-3.25 w-3.25 shrink-0" />
            <span className="font-mono tabular-nums">{activityLabel}</span>
          </span>
          <span className="inline-flex items-center gap-1.25 whitespace-nowrap font-mono tabular-nums">
            <ThumbsUp className="h-3.25 w-3.25 shrink-0" />
            <span>{report.confirmations} confirmed</span>
          </span>
          <span className="inline-flex items-center gap-1.25 whitespace-nowrap font-mono tabular-nums">
            <Check className="h-3.25 w-3.25 shrink-0" />
            <span>{formatCountLabel(report.resolvedConfirmations)} receded</span>
          </span>
        </div>

        <button
          type="button"
          onClick={() => onView?.(report.id)}
          className="ml-auto inline-flex h-7 items-center justify-center rounded-[9px] border border-[var(--color-border)] px-2.5 text-[0.74rem] font-medium text-[var(--color-foreground)]"
        >
          View details
        </button>
      </div>

      <div className="mt-1.5 text-[0.72rem] leading-5 text-[var(--color-muted-foreground)]">
        <div>{getReportTrustSummary(report)}</div>
        <div className="mt-0.5">{getReportCommunitySignal(report)}</div>
      </div>
    </article>
  );
}

function SidebarEmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3.5 py-3 text-[0.82rem] text-[var(--color-muted-foreground)]">
      {children}
    </div>
  );
}

function PanelSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "border-t border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] pt-4",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[0.9rem] font-semibold text-[var(--color-foreground)]">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-[0.74rem] leading-5 text-[var(--color-muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-2.5">{children}</div>
    </section>
  );
}

export function RightInfoPanel({
  alerts,
  weather,
  centers,
  hotlines,
  hotlineNotice,
  timestamp,
  officialAlertsTitle = "Active flood alerts",
  weatherLoading = false,
  weatherError = null,
  alertsLoading = false,
  alertsError = null,
  showCommunityReportsSection = false,
  communityReports = [],
  communityReportsLoading = false,
  communityReportsError = null,
  onViewCommunityReport,
  communityReportsDisclaimer = "Community reports may be unverified.",
  className,
}: RightInfoPanelProps) {
  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-sidebar)] ${className ?? ""}`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4 md:px-5">
        <div className="pb-0.5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
              Live information
            </h2>
            <div className="flex items-center gap-1.5 self-center text-[0.72rem] text-[var(--color-muted-foreground)]">
              <Clock3 className="h-3.25 w-3.25" />
              <span className="font-mono">{timestamp}</span>
            </div>
          </div>
          <p className="mt-1 max-w-[28rem] text-[0.75rem] leading-5 text-[var(--color-muted-foreground)]">
            Active reports first, then weather-based flood risk and nearby shelter references.
          </p>
        </div>

        {showCommunityReportsSection ? (
          <PanelSection
            title="Active reports"
            description={communityReportsDisclaimer}
            className="border-t-0 pt-0"
          >
            {communityReportsLoading ? (
              <SidebarEmptyState>Loading community reports...</SidebarEmptyState>
            ) : communityReportsError ? (
              <SidebarEmptyState>Unable to load community reports.</SidebarEmptyState>
            ) : communityReports.length === 0 ? (
              <SidebarEmptyState>No mapped community reports right now.</SidebarEmptyState>
            ) : (
              <div className="space-y-2">
                {communityReports.map((report) => (
                  <CommunityReportPanelItem
                    key={report.id}
                    report={report}
                    onView={onViewCommunityReport}
                  />
                ))}
              </div>
            )}
          </PanelSection>
        ) : null}

        <PanelSection
          title={officialAlertsTitle}
          description="Weather-based system alerts are estimated and do not replace official advisories."
        >
          {alertsLoading ? (
            <SidebarEmptyState>Checking weather-based flood alerts...</SidebarEmptyState>
          ) : alertsError ? (
            <SidebarEmptyState>{alertsError}</SidebarEmptyState>
          ) : alerts.length === 0 ? (
            <SidebarEmptyState>No major weather-based flood alerts right now.</SidebarEmptyState>
          ) : (
            <div className="space-y-2">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </PanelSection>

        <PanelSection title="Weather overview">
          {weatherLoading ? (
            <SidebarEmptyState>Loading weather data...</SidebarEmptyState>
          ) : weatherError ? (
            <SidebarEmptyState>{weatherError}</SidebarEmptyState>
          ) : (
            <WeatherOverview weather={weather} />
          )}
        </PanelSection>

        <PanelSection
          title="Nearby evacuation centers"
          description="Static shelter references only. Confirm availability with your LGU or barangay."
        >
          <div className="space-y-2">
            {centers.map((center) => (
              <EvacuationCenterCard key={center.id} center={center} />
            ))}
          </div>
        </PanelSection>

        <PanelSection title="Emergency hotlines">
          <div className="grid grid-cols-2 gap-2">
            {hotlines.map((hotline) => (
              <EmergencyHotlineCard key={hotline.id} hotline={hotline} />
            ))}
          </div>

          <div className="mt-3 rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_72%,transparent)] px-3.5 py-3">
            <div className="flex items-start gap-2.5 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{hotlineNotice}</p>
            </div>
          </div>
        </PanelSection>
      </div>
    </aside>
  );
}
