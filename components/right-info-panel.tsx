import { Clock3, Info } from "lucide-react";

import { AlertCard } from "@/components/alert-card";
import { EmergencyHotlineCard } from "@/components/emergency-hotline-card";
import { EvacuationCenterCard } from "@/components/evacuation-center-card";
import { WeatherOverview } from "@/components/weather-overview";
import type {
  EmergencyHotline,
  EvacuationCenter,
  FloodAlert,
  WeatherOverviewData,
} from "@/lib/types";

type RightInfoPanelProps = {
  alerts: FloodAlert[];
  weather: WeatherOverviewData;
  centers: EvacuationCenter[];
  hotlines: EmergencyHotline[];
  hotlineNotice: string;
  timestamp: string;
  className?: string;
};

export function RightInfoPanel({
  alerts,
  weather,
  centers,
  hotlines,
  hotlineNotice,
  timestamp,
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
            ACTIVE FLOOD ALERTS
          </div>
          <div className="mt-3 space-y-3">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        </div>

        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            WEATHER OVERVIEW
          </div>
          <div className="mt-3">
            <WeatherOverview weather={weather} />
          </div>
        </div>

        <div>
          <div className="text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
            NEARBY EVACUATION CENTERS
          </div>
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
