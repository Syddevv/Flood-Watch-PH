"use client";

import { PanelLeftClose, ShieldAlert, X } from "lucide-react";

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
  const activeItemMeta = items.find((item) => item.id === activeItem) ?? items[0];

  return (
    <>
      <div
        aria-hidden="true"
        className={cn(
          "floodwatch-scrim fixed inset-0 z-[var(--layer-sidebar-backdrop)] transition md:hidden",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          "fixed left-0 top-[var(--header-height)] z-[var(--layer-sidebar)] flex h-[calc(100dvh-var(--header-height))] w-[min(84vw,var(--sidebar-width))] flex-col overflow-hidden border-r border-[var(--color-border)] bg-[var(--color-sidebar)] shadow-[var(--shadow-floating)] transition-transform md:static md:h-full md:min-h-0 md:w-[var(--sidebar-width)] md:translate-x-0 md:self-stretch md:shadow-none",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="border-b border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] px-3.5 pb-3 pt-3">
            <div className="mb-2 flex items-center justify-between gap-3 md:hidden">
              <div className="text-[0.7rem] font-medium text-[var(--color-muted-foreground)]">
                Navigation
              </div>
              <button
                type="button"
                aria-label="Close navigation"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_72%,transparent)] px-3 py-2.5">
              <div className="text-[0.66rem] font-medium text-[var(--color-muted-foreground)]">
                Current section
              </div>
              <div className="mt-1 text-[0.82rem] font-semibold text-[var(--color-foreground)]">
                {activeItemMeta.label}
              </div>
              <p className="mt-1 text-[0.72rem] leading-5 text-[var(--color-muted-foreground)]">
                Switch between map monitoring, community reports, shelters, and emergency references.
              </p>
            </div>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4 pt-3">
            <div className="hidden px-1 pb-2 text-[0.68rem] font-medium text-[var(--color-muted-foreground)] md:block">
              Navigation
            </div>
            <ul className="space-y-1.5">
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
                        "group flex w-full items-center gap-3 rounded-[12px] px-2.5 py-2 text-left text-[0.8rem] font-medium transition",
                        active
                          ? "bg-[color:color-mix(in_srgb,var(--color-primary)_8%,var(--color-surface))] text-[var(--color-foreground)] ring-1 ring-[color:color-mix(in_srgb,var(--color-primary)_18%,transparent)]"
                          : "text-[color:color-mix(in_srgb,var(--color-foreground)_82%,var(--color-muted-foreground))] hover:bg-[var(--color-panel)] hover:text-[color:color-mix(in_srgb,var(--color-foreground)_92%,var(--color-muted-foreground))]",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border transition",
                          active
                            ? "border-[color:color-mix(in_srgb,var(--color-primary)_28%,transparent)] bg-[color:color-mix(in_srgb,var(--color-primary)_12%,var(--color-surface))] text-[var(--color-primary)]"
                            : "border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] text-[var(--color-muted-foreground)] group-hover:text-[var(--color-foreground)]",
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full transition",
                          active
                            ? "bg-[var(--color-primary)]"
                            : "bg-transparent group-hover:bg-[color:color-mix(in_srgb,var(--color-muted-foreground)_40%,transparent)]",
                        )}
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 border-t border-[color:color-mix(in_srgb,var(--color-border)_76%,transparent)] px-3.5 pb-[calc(env(safe-area-inset-bottom)+0.9rem)] pt-3">
            <div className="rounded-[14px] border border-[color:color-mix(in_srgb,var(--color-danger)_34%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_8%,var(--color-surface))] p-3">
              <div className="flex items-center gap-2 text-[0.78rem] font-semibold text-[var(--color-danger)]">
                <SignalIcon className="h-3.5 w-3.5" />
                <span>{SIGNAL_CARD.title}</span>
              </div>
              <p className="mt-1.5 text-[0.72rem] leading-5 text-[var(--color-muted-foreground)]">
                {SIGNAL_CARD.description}
              </p>
            </div>

            <button
              type="button"
              aria-label="Collapse navigation"
              onClick={onClose}
              className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[11px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_68%,transparent)] px-3 py-2 text-[0.78rem] font-medium text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)] md:hidden"
            >
              <PanelLeftClose className="h-3.5 w-3.5" />
              <span>Close menu</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
