import { Clock3 } from "lucide-react";

import { AlertCard } from "@/components/alert-card";
import { EvacuationCenterCard } from "@/components/evacuation-center-card";
import { WeatherOverview } from "@/components/weather-overview";
import type {
  EvacuationCenter,
  FloodAlert,
  WeatherOverviewData,
} from "@/lib/types";

type RightInfoPanelProps = {
  alerts: FloodAlert[];
  weather: WeatherOverviewData;
  centers: EvacuationCenter[];
  timestamp: string;
  className?: string;
};

export function RightInfoPanel({
  alerts,
  weather,
  centers,
  timestamp,
  className,
}: RightInfoPanelProps) {
  return (
    <aside
      className={`flex h-full min-h-0 flex-col border-l border-[var(--color-border)] bg-[var(--color-sidebar)] ${className ?? ""}`}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4 md:px-4.5">
        <div>
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-[1.1rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
              Live Information
            </h2>
            <div className="flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
              <Clock3 className="h-3.25 w-3.25" />
              <span className="font-mono">{timestamp}</span>
            </div>
          </div>

          <div className="mt-5 text-[0.72rem] font-semibold tracking-[0.08em] text-[var(--color-section-heading)]">
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
      </div>
    </aside>
  );
}
