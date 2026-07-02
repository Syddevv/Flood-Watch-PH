"use client";

import { X } from "lucide-react";

import { RightInfoPanel } from "@/components/right-info-panel";
import type {
  EmergencyHotline,
  EvacuationCenter,
  FloodAlert,
  IncidentReport,
  WeatherOverviewData,
} from "@/lib/types";

type MobileLiveInfoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
  onViewAlert?: (alertId: string) => void;
  communityReportsDisclaimer?: string;
};

export function MobileLiveInfoSheet({
  open,
  onOpenChange,
  alerts,
  weather,
  weatherLoading,
  weatherError,
  alertsLoading,
  alertsError,
  centers,
  hotlines,
  hotlineNotice,
  timestamp,
  officialAlertsTitle,
  showCommunityReportsSection,
  communityReports,
  communityReportsLoading,
  communityReportsError,
  onViewCommunityReport,
  onViewAlert,
  communityReportsDisclaimer,
}: MobileLiveInfoSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="floodwatch-scrim fixed inset-0 z-[var(--layer-sheet-backdrop)] transition md:hidden"
        onClick={() => onOpenChange(false)}
      />
      <section
        aria-label="Live information"
        className="floodwatch-sheet fixed inset-x-0 bottom-0 z-[var(--layer-sheet)] max-h-[78vh] rounded-t-[22px] border border-[var(--color-border)] bg-[var(--color-sidebar)] md:hidden"
      >
        <div className="border-b border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] px-4 pb-2 pt-3">
          <div className="flex justify-center">
            <div className="h-1.5 w-12 rounded-full bg-[var(--color-border)]" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0 text-[0.82rem] font-semibold text-[var(--color-foreground)]">
              Live information
            </div>
            <button
              type="button"
              aria-label="Close live information"
              onClick={() => onOpenChange(false)}
              className="rounded-full p-2 text-[var(--color-muted-foreground)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="h-[calc(78vh-4.5rem)] min-h-0 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
          <RightInfoPanel
            alerts={alerts}
            weather={weather}
            weatherLoading={weatherLoading}
            weatherError={weatherError}
            alertsLoading={alertsLoading}
            alertsError={alertsError}
            centers={centers}
            hotlines={hotlines}
            hotlineNotice={hotlineNotice}
            timestamp={timestamp}
            officialAlertsTitle={officialAlertsTitle}
            showCommunityReportsSection={showCommunityReportsSection}
            communityReports={communityReports}
            communityReportsLoading={communityReportsLoading}
            communityReportsError={communityReportsError}
            onViewCommunityReport={onViewCommunityReport}
            onViewAlert={(alertId) => {
              onOpenChange(false);
              onViewAlert?.(alertId);
            }}
            communityReportsDisclaimer={communityReportsDisclaimer}
            className="border-l-0"
          />
        </div>
      </section>
    </>
  );
}
