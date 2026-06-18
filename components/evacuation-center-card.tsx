import { CheckCircle2, MapPinned } from "lucide-react";

import type { EvacuationCenter } from "@/lib/types";
import {
  buildEvacuationCenterLocationLabel,
  EVACUATION_STATUS_META,
  formatLastVerified,
} from "@/lib/emergency-resources";
import { cn } from "@/lib/utils";

export function EvacuationCenterCard({
  center,
}: {
  center: EvacuationCenter;
}) {
  const statusMeta = EVACUATION_STATUS_META[center.status];

  return (
    <article className="rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_92%,transparent)] px-3.5 py-2.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[0.88rem] font-semibold text-[var(--color-foreground)]">
            {center.name}
          </h3>
          <div className="mt-0.5 flex items-center gap-1.5 text-[0.74rem] text-[var(--color-muted-foreground)]">
            <MapPinned className="h-3.25 w-3.25" />
            <span className="truncate">{center.city}</span>
          </div>
          <div className="mt-0.5 truncate text-[0.68rem] text-[var(--color-muted-foreground)]">
            {buildEvacuationCenterLocationLabel(center)}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold",
            statusMeta.badgeClassName,
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      {center.lastVerifiedAt ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.68rem] text-[var(--color-muted-foreground)]">
          <CheckCircle2 className="h-3.25 w-3.25 text-[var(--color-success)]" />
          <span>Last verified {formatLastVerified(center.lastVerifiedAt)}</span>
        </div>
      ) : null}
    </article>
  );
}
