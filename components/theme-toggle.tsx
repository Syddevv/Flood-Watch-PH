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
        "flex h-10 w-10 items-center justify-center rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] transition hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]",
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
