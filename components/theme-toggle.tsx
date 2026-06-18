"use client";

import { Moon, SunMedium } from "lucide-react";

import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  theme: "light" | "dark";
  onToggle: () => void;
  className?: string;
};

export function ThemeToggle({
  theme,
  onToggle,
  className,
}: ThemeToggleProps) {
  return (
    <button
      type="button"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
      onClick={onToggle}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] transition hover:border-[color:color-mix(in_srgb,var(--color-primary)_36%,transparent)] hover:text-[var(--color-primary)]",
        className,
      )}
    >
      {theme === "light" ? (
        <Moon className="h-4 w-4" />
      ) : (
        <SunMedium className="h-4 w-4" />
      )}
    </button>
  );
}
