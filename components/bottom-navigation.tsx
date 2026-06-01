"use client";

import type { NavItem } from "@/lib/types";
import { cn } from "@/lib/utils";

type BottomNavigationProps = {
  items: NavItem[];
  activeItem: string;
  onSelect: (id: string) => void;
};

export function BottomNavigation({
  items,
  activeItem,
  onSelect,
}: BottomNavigationProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-[950] border-t border-[var(--color-border)] bg-[var(--color-sidebar)] px-3 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 shadow-[0_-20px_60px_rgba(15,23,42,0.24)] md:hidden">
      <ul className="grid grid-cols-5 gap-2">
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = item.id === activeItem;

          return (
            <li key={item.id}>
              <button
                type="button"
                aria-label={item.label}
                onClick={() => onSelect(item.id)}
                className={cn(
                  "flex w-full flex-col items-center gap-1.5 rounded-2xl px-1 py-2 text-[0.56rem] font-medium transition",
                  active
                    ? "text-[var(--color-primary)]"
                    : "text-[var(--color-muted-foreground)]",
                )}
              >
                <Icon className="h-4.5 w-4.5" />
                <span>{item.label.split(" ")[0]}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
