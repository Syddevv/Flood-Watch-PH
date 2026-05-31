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
          "fixed inset-y-[var(--header-height)] left-0 z-[910] flex w-[min(82vw,var(--sidebar-width))] flex-col border-r border-[var(--color-border)] bg-[var(--color-sidebar)] transition-transform md:static md:h-full md:min-h-0 md:w-[var(--sidebar-width)] md:translate-x-0 md:self-stretch",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-end px-3 py-3 md:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <nav className="min-h-0 flex-1 overflow-y-auto px-3 pb-3 pt-3 md:pt-3">
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
                        "flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.75 text-left text-[0.93rem] font-medium transition",
                        active
                          ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "text-[var(--color-foreground)] hover:bg-[var(--color-panel)]",
                      )}
                    >
                      <Icon className="h-4.25 w-4.25 shrink-0" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-[var(--color-border)] px-3 py-3">
            <div className="rounded-[16px] border border-[color:color-mix(in_srgb,var(--color-danger)_38%,transparent)] bg-[color:color-mix(in_srgb,var(--color-danger)_10%,var(--color-surface))] p-3.5 shadow-[var(--shadow-soft)]">
              <div className="flex items-center gap-2 text-[0.88rem] font-semibold text-[var(--color-danger)]">
                <SignalIcon className="h-3.5 w-3.5" />
                <span>{SIGNAL_CARD.title}</span>
              </div>
              <p className="mt-2 text-[0.82rem] leading-6 text-[var(--color-muted-foreground)]">
                {SIGNAL_CARD.description}
              </p>
            </div>

            <button
              type="button"
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-2xl px-3 py-2.75 text-[0.88rem] font-medium text-[var(--color-muted-foreground)] transition hover:bg-[var(--color-panel)] hover:text-[var(--color-foreground)]"
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
