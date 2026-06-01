"use client";

import {
  AlertTriangle,
  Menu,
  Plus,
  Search,
} from "lucide-react";

import {
  ACTIVE_ALERTS_LABEL,
  HEADER_SUBTITLE,
  REPORT_LABEL,
  SEARCH_PLACEHOLDER,
} from "@/lib/constants";
import type { Theme } from "@/lib/types";

import { BrandMark } from "./brand-mark";
import { ThemeToggle } from "./theme-toggle";

type AppHeaderProps = {
  theme: Theme;
  onToggleTheme: () => void;
  onOpenSidebar: () => void;
};

export function AppHeader({
  theme,
  onToggleTheme,
  onOpenSidebar,
}: AppHeaderProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-[1000] flex h-[var(--header-height)] items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-sidebar)] px-4 sm:px-5 md:px-6">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] md:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="hidden md:flex md:items-center md:gap-2.5">
          <BrandMark />
          <div>
            <div className="text-[1.06rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
              FloodWatch PH
            </div>
            <div className="text-[0.72rem] leading-none text-[var(--color-muted-foreground)]">
              {HEADER_SUBTITLE}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2.5 md:hidden">
          <BrandMark />
        </div>
      </div>

      <div className="mx-5 hidden min-w-0 max-w-[640px] flex-1 md:block">
        <label className="flex h-10 items-center gap-2.5 rounded-full border border-[var(--color-border)] bg-[var(--color-panel)] px-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]">
          <Search className="h-[15px] w-[15px] text-[var(--color-muted-foreground)]" />
          <input
            type="search"
            placeholder={SEARCH_PLACEHOLDER}
            className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 sm:gap-2.5">
        <button
          type="button"
          aria-label="Search"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] md:hidden"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          className="flex h-8.5 items-center gap-1 rounded-full border border-[color:color-mix(in_srgb,var(--color-danger)_32%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] px-2.5 text-[0.66rem] font-semibold text-[var(--color-danger)] sm:h-9 sm:gap-1.5 sm:px-3.5 sm:text-[0.78rem]"
        >
          <span className="h-2 w-2 rounded-full bg-[var(--color-danger)]" />
          <AlertTriangle className="hidden h-[13px] w-[13px] sm:block" />
          <span>{ACTIVE_ALERTS_LABEL}</span>
        </button>

        <button
          type="button"
          className="hidden h-9 items-center gap-1.5 rounded-full bg-[var(--color-primary)] px-4 text-[0.78rem] font-semibold text-white transition hover:brightness-105 lg:flex"
        >
          <Plus className="h-[13px] w-[13px]" />
          <span>{REPORT_LABEL}</span>
        </button>

        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
      </div>
    </header>
  );
}
