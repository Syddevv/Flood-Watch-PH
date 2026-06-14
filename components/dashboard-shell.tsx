"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SquareStack } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { AboutContent } from "@/components/about-content";
import { EmergencyHotlinesContent } from "@/components/emergency-hotlines-content";
import { FloodMap } from "@/components/flood-map";
import { EvacuationCentersContent } from "@/components/evacuation-centers-content";
import { IncidentReportsContent } from "@/components/incident-reports-content";
import { MobileLiveInfoSheet } from "@/components/mobile-live-info-sheet";
import { RightInfoPanel } from "@/components/right-info-panel";
import { Sidebar } from "@/components/sidebar";
import { WeatherMonitoringContent } from "@/components/weather-monitoring-content";
import {
  ACTIVE_ALERTS,
  EMERGENCY_HOTLINES,
  EVACUATION_CENTERS,
  FLOOD_LEGEND,
  FLOOD_POLYGONS,
  HOTLINE_NOTICE,
  LIVE_TIMESTAMP,
  NAV_ITEMS,
  REPORT_MARKER_LEGEND,
  REPORT_LABEL,
  THEME_STORAGE_KEY,
  WEATHER_OVERVIEW,
} from "@/lib/constants";
import type { Theme } from "@/lib/types";
import { cn } from "@/lib/utils";

type DashboardShellProps = {
  pageMode?:
    | "dashboard"
    | "flood-map"
    | "weather-monitoring"
    | "evacuation-centers"
    | "incident-reports"
      | "emergency-hotlines"
      | "about";
};

function getActiveItemFromPageMode(
  pageMode: NonNullable<DashboardShellProps["pageMode"]>,
) {
  return pageMode === "flood-map"
    ? "flood-map"
    : pageMode === "weather-monitoring"
      ? "weather-monitoring"
      : pageMode === "evacuation-centers"
        ? "evacuation-centers"
        : pageMode === "incident-reports"
          ? "incident-reports"
          : pageMode === "emergency-hotlines"
            ? "emergency-hotlines"
            : pageMode === "about"
              ? "about"
              : "dashboard";
}

export function DashboardShell({
  pageMode = "dashboard",
}: DashboardShellProps) {
  const router = useRouter();
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") {
      return "light";
    }

    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      return stored === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeItem = getActiveItemFromPageMode(pageMode);
  const isFloodMapView = pageMode === "flood-map";
  const isWeatherMonitoringView = pageMode === "weather-monitoring";
  const isEvacuationCentersView = pageMode === "evacuation-centers";
  const isIncidentReportsView = pageMode === "incident-reports";
  const isEmergencyHotlinesView = pageMode === "emergency-hotlines";
  const isAboutView = pageMode === "about";
  const isContentOnlyView =
    isFloodMapView ||
    isWeatherMonitoringView ||
    isEvacuationCentersView ||
    isIncidentReportsView ||
    isEmergencyHotlinesView ||
    isAboutView;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => {
      const nextTheme: Theme = currentTheme === "light" ? "dark" : "light";
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
      return nextTheme;
    });
  };

  const handleSelect = (id: string) => {
    setSheetOpen(false);
    setSidebarOpen(false);

    if (id === "dashboard") {
      router.push("/");
      return;
    }

    if (id === "flood-map") {
      router.push("/flood-map");
      return;
    }

    if (id === "weather-monitoring") {
      router.push("/weather-monitoring");
      return;
    }

    if (id === "evacuation-centers") {
      router.push("/evacuation-centers");
      return;
    }

    if (id === "incident-reports") {
      router.push("/incident-reports");
      return;
    }

    if (id === "emergency-hotlines") {
      router.push("/emergency-hotlines");
      return;
    }

    if (id === "about") {
      router.push("/about");
      return;
    }
    setSheetOpen(false);
  };

  return (
    <div className="h-screen overflow-hidden bg-[var(--color-background)] text-[var(--color-foreground)]">
      <AppHeader
        theme={theme}
        onToggleTheme={toggleTheme}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <div
        className="pt-[var(--header-height)]"
      >
        <div
          className={cn(
            "grid h-[calc(100vh-var(--header-height))] min-h-0 bg-[var(--color-background)]",
            isContentOnlyView
              ? "md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)]"
              : "md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--panel-width)]",
          )}
        >
          <Sidebar
            items={NAV_ITEMS}
            activeItem={activeItem}
            onSelect={handleSelect}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main
            className={cn(
              "relative h-full min-h-0 overflow-hidden md:col-start-2",
              isContentOnlyView && "md:col-end-4",
            )}
          >
            {isWeatherMonitoringView ? (
              <WeatherMonitoringContent />
            ) : isEvacuationCentersView ? (
              <EvacuationCentersContent />
            ) : isIncidentReportsView ? (
              <IncidentReportsContent />
            ) : isEmergencyHotlinesView ? (
              <EmergencyHotlinesContent />
            ) : isAboutView ? (
              <AboutContent />
            ) : (
              <div className="h-full min-h-0 w-full">
                <FloodMap
                  theme={theme}
                  polygons={FLOOD_POLYGONS}
                  legend={isFloodMapView ? REPORT_MARKER_LEGEND : FLOOD_LEGEND}
                  allowPolygonToggle={isFloodMapView}
                  defaultShowPolygons={!isFloodMapView}
                />
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 bottom-6 z-[500] flex items-end justify-between px-4 md:hidden">
              {!isContentOnlyView ? (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)]"
                >
                  <SquareStack className="h-4 w-4" />
                  <span>Live Info</span>
                </button>
              ) : (
                <div />
              )}

              <button
                type="button"
                className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[#ff695f] px-5 text-sm font-semibold text-slate-950 shadow-[0_18px_40px_rgba(255,105,95,0.32)]"
              >
                <Plus className="h-4 w-4" />
                <span>{REPORT_LABEL.replace("Incident", "").trim()}</span>
              </button>
            </div>
          </main>

          {!isContentOnlyView ? (
            <RightInfoPanel
              alerts={ACTIVE_ALERTS}
              weather={WEATHER_OVERVIEW}
              centers={EVACUATION_CENTERS}
              hotlines={EMERGENCY_HOTLINES}
              hotlineNotice={HOTLINE_NOTICE}
              timestamp={LIVE_TIMESTAMP}
              className="hidden md:flex"
            />
          ) : null}
        </div>
      </div>

      {!isContentOnlyView ? (
        <MobileLiveInfoSheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          alerts={ACTIVE_ALERTS}
          weather={WEATHER_OVERVIEW}
          centers={EVACUATION_CENTERS}
          hotlines={EMERGENCY_HOTLINES}
          hotlineNotice={HOTLINE_NOTICE}
          timestamp={LIVE_TIMESTAMP}
        />
      ) : null}
    </div>
  );
}
