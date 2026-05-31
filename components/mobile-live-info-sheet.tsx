"use client";

import { X } from "lucide-react";

import { RightInfoPanel } from "@/components/right-info-panel";
import type {
  EmergencyHotline,
  EvacuationCenter,
  FloodAlert,
  WeatherOverviewData,
} from "@/lib/types";
import { cn } from "@/lib/utils";

type MobileLiveInfoSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: FloodAlert[];
  weather: WeatherOverviewData;
  centers: EvacuationCenter[];
  hotlines: EmergencyHotline[];
  hotlineNotice: string;
  timestamp: string;
};

export function MobileLiveInfoSheet({
  open,
  onOpenChange,
  alerts,
  weather,
  centers,
  hotlines,
  hotlineNotice,
  timestamp,
}: MobileLiveInfoSheetProps) {
  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[980] bg-slate-950/38 transition md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => onOpenChange(false)}
      />
      <section
        aria-label="Live information"
        className={cn(
          "fixed inset-x-0 bottom-[4.75rem] z-[990] max-h-[72vh] rounded-t-[28px] border border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-[0_-25px_60px_rgba(15,23,42,0.32)] transition-transform duration-300 md:hidden",
          open ? "translate-y-0" : "translate-y-[calc(100%-5.5rem)]",
        )}
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
            centers={centers}
            hotlines={hotlines}
            hotlineNotice={hotlineNotice}
            timestamp={timestamp}
            className="border-l-0"
          />
        </div>
      </section>
    </>
  );
}
