import { CheckCircle2, MapPinned } from "lucide-react";

import type { EvacuationCenter } from "@/lib/types";
import { EVACUATION_STATUS_META, formatLastVerified } from "@/lib/emergency-resources";
import { cn } from "@/lib/utils";

export function EvacuationCenterCard({
  center,
}: {
  center: EvacuationCenter;
}) {
  const statusMeta = EVACUATION_STATUS_META[center.status];

  return (
    <article className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2.5">
        <div>
          <h3 className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
            {center.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
            <MapPinned className="h-3.25 w-3.25" />
            <span>{center.cityOrMunicipality}</span>
          </div>
          <div className="mt-1 text-[0.72rem] text-[var(--color-muted-foreground)]">
            {center.barangay}
          </div>
        </div>
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold",
            statusMeta.badgeClassName,
          )}
        >
          {center.status}
        </span>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
        <CheckCircle2 className="h-3.25 w-3.25 text-[var(--color-success)]" />
        <span>Last verified {formatLastVerified(center.lastVerifiedAt)}</span>
      </div>
    </article>
  );
}
