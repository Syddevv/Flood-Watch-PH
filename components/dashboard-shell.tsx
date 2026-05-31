"use client";

import { useEffect, useState } from "react";
import { Plus, SquareStack } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { BottomNavigation } from "@/components/bottom-navigation";
import { FloodMap } from "@/components/flood-map";
import { MobileLiveInfoSheet } from "@/components/mobile-live-info-sheet";
import { RightInfoPanel } from "@/components/right-info-panel";
import { Sidebar } from "@/components/sidebar";
import {
  ACTIVE_ALERTS,
  EVACUATION_CENTERS,
  FLOOD_LEGEND,
  FLOOD_POLYGONS,
  LIVE_TIMESTAMP,
  MAP_MARKERS,
  NAV_ITEMS,
  REPORT_LABEL,
  THEME_STORAGE_KEY,
  WEATHER_OVERVIEW,
} from "@/lib/constants";
import type { Theme } from "@/lib/types";

export function DashboardShell() {
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
  const [activeItem, setActiveItem] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

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
          className="grid h-[calc(100vh-var(--header-height))] min-h-0 bg-[var(--color-background)] md:grid-cols-[var(--sidebar-width)_minmax(0,1fr)_var(--panel-width)]"
        >
          <Sidebar
            items={NAV_ITEMS}
            activeItem={activeItem}
            onSelect={setActiveItem}
            open={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />

          <main className="relative h-full min-h-0 overflow-hidden md:col-start-2">
            <div className="h-full min-h-0 w-full">
              <FloodMap
                theme={theme}
                markers={MAP_MARKERS}
                polygons={FLOOD_POLYGONS}
                legend={FLOOD_LEGEND}
              />
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-[5.35rem] z-[500] flex items-end justify-between px-4 md:hidden">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="pointer-events-auto flex h-12 items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(37,99,235,0.38)]"
              >
                <SquareStack className="h-4 w-4" />
                <span>Live Info</span>
              </button>

              <button
                type="button"
                className="pointer-events-auto flex h-14 items-center gap-2 rounded-full bg-[#ff695f] px-6 text-base font-semibold text-slate-950 shadow-[0_18px_40px_rgba(255,105,95,0.32)]"
              >
                <Plus className="h-5 w-5" />
                <span>{REPORT_LABEL.replace("Incident", "").trim()}</span>
              </button>
            </div>
          </main>

          <RightInfoPanel
            alerts={ACTIVE_ALERTS}
            weather={WEATHER_OVERVIEW}
            centers={EVACUATION_CENTERS}
            timestamp={LIVE_TIMESTAMP}
            className="hidden md:flex"
          />
        </div>
      </div>

      <BottomNavigation
        items={NAV_ITEMS}
        activeItem={activeItem}
        onSelect={setActiveItem}
      />

      <MobileLiveInfoSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        alerts={ACTIVE_ALERTS}
        weather={WEATHER_OVERVIEW}
        centers={EVACUATION_CENTERS}
        timestamp={LIVE_TIMESTAMP}
      />
    </div>
  );
}
