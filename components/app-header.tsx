"use client";

import {
  AlertTriangle,
  Menu,
  Plus,
} from "lucide-react";

import {
  ACTIVE_ALERTS_LABEL,
  HEADER_SUBTITLE,
  REPORT_LABEL,
} from "@/lib/constants";
import type { Theme } from "@/lib/types";

import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";

type AppHeaderProps = {
  activeItemLabel: string;
  theme: Theme;
  liveAlertsCount: number;
  liveAlertsEnabled?: boolean;
  onOpenLiveAlerts: () => void;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
  onReportFlood: () => void;
};

export function AppHeader({
  activeItemLabel,
  theme,
  liveAlertsCount,
  liveAlertsEnabled = true,
  onOpenLiveAlerts,
  onToggleTheme,
  onOpenSidebar,
  onReportFlood,
}: AppHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-[var(--layer-header)] border-b border-[color:color-mix(in_srgb,var(--color-border)_82%,transparent)] bg-[var(--color-sidebar)] px-3 sm:px-5 md:px-6">
      <div className="flex h-[var(--header-height)] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={onOpenSidebar}
            className="flex h-9 w-9 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface)] text-[var(--color-foreground)] md:hidden"
          >
            <Menu className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 items-center gap-2.5 md:gap-3">
            <BrandMark className="h-9 w-9 shrink-0" />
            <div className="min-w-0">
              <div className="truncate text-[0.95rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)] md:text-[1.04rem]">
                FloodWatch PH
              </div>
              <div className="hidden text-[0.7rem] leading-none text-[var(--color-muted-foreground)] sm:block">
                {HEADER_SUBTITLE}
              </div>
              <div className="text-[0.66rem] leading-none text-[var(--color-muted-foreground)] sm:hidden">
                {activeItemLabel}
              </div>
            </div>
          </div>

        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={onOpenLiveAlerts}
            disabled={!liveAlertsEnabled}
            className="flex h-9 items-center gap-1.5 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-danger)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_8%,var(--color-surface))] px-2.5 text-[0.72rem] font-semibold text-[var(--color-danger)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:border-[var(--color-border)] disabled:bg-[var(--color-surface)] disabled:text-[var(--color-muted-foreground)] sm:px-3"
          >
            <span className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
            <AlertTriangle className="hidden h-[13px] w-[13px] sm:block" />
            <span className="hidden sm:inline">{ACTIVE_ALERTS_LABEL}</span>
            <span className="sm:hidden">Alerts</span>
            {liveAlertsCount > 0 ? (
              <span className="rounded-full bg-[var(--color-danger)] px-1.5 py-0.5 font-mono text-[0.66rem] leading-none text-white tabular-nums">
                {liveAlertsCount}
              </span>
            ) : null}
          </button>

          <button
            type="button"
            onClick={onReportFlood}
            className="floodwatch-primary-action hidden h-9 items-center gap-1.5 rounded-[11px] px-3 text-[0.76rem] font-semibold transition hover:brightness-105 md:flex"
          >
            <Plus className="h-[13px] w-[13px]" />
            <span className="hidden xl:inline">{REPORT_LABEL}</span>
            <span className="xl:hidden">Report</span>
          </button>

          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        </div>
      </div>
    </header>
  );
}
