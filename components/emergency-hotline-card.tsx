import { Phone } from "lucide-react";

import type { EmergencyHotline } from "@/lib/types";

export function EmergencyHotlineCard({
  hotline,
}: {
  hotline: EmergencyHotline;
}) {
  const Icon = hotline.icon;

  return (
    <article className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] p-2.5">
      <div className="flex items-start gap-2.5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[var(--color-panel)] text-[var(--color-primary)]">
          <Icon className="h-3.25 w-3.25" strokeWidth={2} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h3 className="truncate text-[0.8rem] font-medium leading-5 text-[var(--color-foreground)]">
            {hotline.name}
          </h3>
          <p className="mt-0.5 text-[0.72rem] leading-none text-[var(--color-muted-foreground)]">
            {hotline.number}
          </p>
        </div>
      </div>

      <button
        type="button"
        className="mt-2 flex h-8 w-full items-center justify-center gap-2 rounded-[9px] border border-[var(--color-border)] bg-[var(--color-panel)] text-[0.8rem] font-medium text-[var(--color-foreground)]"
      >
        <Phone className="h-3.25 w-3.25" />
        <span>Call</span>
      </button>
    </article>
  );
}
