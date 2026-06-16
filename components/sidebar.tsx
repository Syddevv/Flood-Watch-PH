"use client";

import { PanelLeftClose, ShieldAlert } from "lucide-react";

import { SIGNAL_CARD } from "@/lib/constants";
import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type SidebarProps = {
  items: NavItem[];
  activeItem: string;
  onSelect: (id: string) => void;
  open: boolean;
  onClose: () => void;
};

export function Sidebar({
  items,
  activeItem,
  onSelect,
  open,
  onClose,
}: SidebarProps) {
  const SignalIcon = SIGNAL_CARD.icon ?? ShieldAlert;

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "fixed inset-0 z-[900] bg-slate-950/40 transition md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed left-0 top-[var(--header-height)] z-[910] flex h-[calc(100dvh-var(--header-height))] w-[min(82vw,var(--sidebar-width))] flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-sidebar)] transition-transform md:static md:h-full md:min-h-0 md:w-[var(--sidebar-width)] md:translate-x-0 md:self-stretch",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4 pt-3">
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                const active = activeItem === item.id;

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(item.id);
                        onClose();
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left text-[0.82rem] font-medium transition",
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "text-[color:color-mix(in_srgb,var(--color-foreground)_82%,var(--color-muted-foreground))] hover:bg-[var(--color-panel)] hover:text-[color:color-mix(in_srgb,var(--color-foreground)_92%,var(--color-muted-foreground))]",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 border-t border-[var(--color-border)] px-2.5 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3">
            <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--color-danger)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] p-3.5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[0.8rem] font-semibold text-[var(--color-danger)]">
                <SignalIcon className="h-3.5 w-3.5" />
                <span>{SIGNAL_CARD.title}</span>
              </div>
              <p className="mt-2 text-[0.72rem] leading-5.5 text-[var(--color-muted-foreground)]">
                {SIGNAL_CARD.description}
              </p>
            </div>

            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={onClose}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.5 text-[0.8rem] font-medium text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-panel)] hover:text-[var(--color-foreground)]"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span>Collapse</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
