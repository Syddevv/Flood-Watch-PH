import { MapPinned } from "lucide-react";

import type { EvacuationCenter } from "@/lib/types";

export function EvacuationCenterCard({
  center,
}: {
  center: EvacuationCenter;
}) {
  return (
    <article className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h3 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            {center.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
            <MapPinned className="h-3.25 w-3.25" />
            <span>{center.distance}</span>
          </div>
        </div>
        <span className="rounded-full border border-[color:color-mix(in_srgb,var(--color-success)_25%,transparent)] bg-[color:color-mix(in_srgb,var(--color-success)_12%,var(--color-surface))] px-2.5 py-1 text-[0.68rem] font-semibold text-[var(--color-success)]">
          {center.status}
        </span>
      </div>
    </article>
  );
}
