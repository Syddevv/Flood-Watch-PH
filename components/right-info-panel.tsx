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

  return (
    <article className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]">
      <div className="flex gap-3">
        {thumbnailUrl ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbnailUrl}
            alt={report.title}
            className="h-14 w-14 shrink-0 rounded-[12px] object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1">
          <div className="truncate text-[0.92rem] font-semibold text-[var(--color-foreground)]">
            {report.title}
          </div>
          <div className="mt-1 truncate text-[0.78rem] text-[var(--color-muted-foreground)]">
            {report.location}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
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
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[0.74rem] text-[var(--color-muted-foreground)]">
        <Clock3 className="h-3.5 w-3.5" />
        <span>{report.lastActivityAgo ?? report.reportedAgo}</span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[0.72rem] text-[var(--color-muted-foreground)]">
        <div className="rounded-[10px] bg-[var(--color-panel)] px-2 py-2">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" />
            <span>{formatCountLabel(report.confirmations)}</span>
          </div>
        </div>
        <div className="rounded-[10px] bg-[var(--color-panel)] px-2 py-2">
          <div className="flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>{formatCountLabel(report.resolvedConfirmations)} receded</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[0.75rem] text-[var(--color-muted-foreground)]">
        {getReportCommunitySignal(report)}
      </div>

      <button
        type="button"
        onClick={() => onView?.(report.id)}
        className="mt-3 flex h-9 items-center justify-center rounded-[11px] bg-[var(--color-primary)] px-3 text-[0.82rem] font-semibold text-white"
      >
        View Details
      </button>
    </article>
  );
}

export function RightInfoPanel({
  alerts,
  weather,
  centers,
  hotlines,
  hotlineNotice,
  timestamp,
  officialAlertsTitle = "ACTIVE FLOOD ALERTS",
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
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 md:px-5">
        <div>
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-[1.16rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
              Live Information
            </h2>
            <div className="flex items-center gap-1.5 self-center text-[0.72rem] text-[var(--color-muted-foreground)]">
              <Clock3 className="h-3.25 w-3.25" />
              <span className="font-mono">{timestamp}</span>
            </div>
          </div>

          <div className="mt-5 text-[0.73rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            {officialAlertsTitle}
          </div>
          <p className="mt-2 text-[0.76rem] text-[var(--color-muted-foreground)]">
            System alerts are not official advisories. Follow PAGASA, NDRRMC, and LGU updates.
          </p>
          {alertsLoading ? (
            <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
              Checking weather-based flood alerts...
            </div>
          ) : alertsError ? (
            <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
              {alertsError}
            </div>
          ) : alerts.length === 0 ? (
            <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
              No major weather-based flood alerts right now.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>

        {showCommunityReportsSection ? (
          <div>
            <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
              LIVE COMMUNITY REPORTS
            </div>
            <p className="mt-2 text-[0.76rem] text-[var(--color-muted-foreground)]">
              {communityReportsDisclaimer}
            </p>
            {communityReportsLoading ? (
              <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
                Loading community reports...
              </div>
            ) : communityReportsError ? (
              <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
                Unable to load community reports.
              </div>
            ) : communityReports.length === 0 ? (
              <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
                No mapped community reports right now.
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                {communityReports.map((report) => (
                  <CommunityReportPanelItem
                    key={report.id}
                    report={report}
                    onView={onViewCommunityReport}
                  />
                ))}
              </div>
            )}
          </div>
        ) : null}

        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            WEATHER OVERVIEW
          </div>
          {weatherLoading ? (
            <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
              Loading weather data...
            </div>
          ) : weatherError ? (
            <div className="mt-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-[0.86rem] text-[var(--color-muted-foreground)]">
              {weatherError}
            </div>
          ) : (
            <div className="mt-3">
              <WeatherOverview weather={weather} />
            </div>
          )}
        </div>

        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            NEARBY EVACUATION CENTERS
          </div>
          <p className="mt-2 text-[0.76rem] text-[var(--color-muted-foreground)]">
            Static shelter references only. Confirm availability with your LGU or barangay.
          </p>
          <div className="mt-3 space-y-3">
            {centers.map((center) => (
              <EvacuationCenterCard key={center.id} center={center} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            EMERGENCY HOTLINES
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {hotlines.map((hotline) => (
              <EmergencyHotlineCard key={hotline.id} hotline={hotline} />
            ))}
          </div>

          <div className="mt-5 rounded-[16px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-3.5">
            <div className="flex items-start gap-2.5 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{hotlineNotice}</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
