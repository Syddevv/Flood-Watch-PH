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
  communityReportsDisclaimer,
}: MobileLiveInfoSheetProps) {
  if (!open) {
    return null;
  }

  return (
    <>
      <div
        aria-hidden="true"
        className="fixed inset-0 z-[980] bg-slate-950/38 transition md:hidden"
        onClick={() => onOpenChange(false)}
      />
      <section
        aria-label="Live information"
        className="fixed inset-x-0 bottom-0 z-[990] max-h-[72vh] rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-[0_-25px_60px_rgba(15,23,42,0.32)] md:hidden"
      >
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div className="mx-auto h-1.5 w-14 rounded-full bg-[var(--color-border)]" />
          <button
            type="button"
            aria-label="Close live information"
            onClick={() => onOpenChange(false)}
            className="rounded-full p-2 text-[var(--color-muted-foreground)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="h-[calc(72vh-3.5rem)] min-h-0">
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
            communityReportsDisclaimer={communityReportsDisclaimer}
            className="border-l-0"
          />
        </div>
      </section>
    </>
  );
}
