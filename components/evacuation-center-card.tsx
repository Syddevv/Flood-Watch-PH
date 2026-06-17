import { CheckCircle2, Database, MapPinned } from "lucide-react";

import type { EvacuationCenter } from "@/lib/types";
import {
  buildEvacuationCenterLocationLabel,
  EVACUATION_SOURCE_META,
  EVACUATION_STATUS_META,
  EVACUATION_VERIFICATION_META,
  formatLastVerified,
} from "@/lib/emergency-resources";
import { cn } from "@/lib/utils";

export function EvacuationCenterCard({
  center,
}: {
  center: EvacuationCenter;
}) {
  const statusMeta = EVACUATION_STATUS_META[center.status];
  const verificationMeta = EVACUATION_VERIFICATION_META[center.verificationStatus];
  const sourceMeta = EVACUATION_SOURCE_META[center.sourceType];

  return (
    <article className="rounded-[16px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <h3 className="text-[0.94rem] font-semibold text-[var(--color-foreground)]">
            {center.name}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
            <MapPinned className="h-3.25 w-3.25" />
            <span className="truncate">{center.city}</span>
          </div>
          <div className="mt-1 truncate text-[0.72rem] text-[var(--color-muted-foreground)]">
            {buildEvacuationCenterLocationLabel(center)}
          </div>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold",
            statusMeta.badgeClassName,
          )}
        >
          {statusMeta.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span
          className={cn(
            "rounded-full border px-2.5 py-1 text-[0.66rem] font-medium",
            verificationMeta.badgeClassName,
          )}
        >
          {verificationMeta.label}
        </span>
        <span className="rounded-full border border-[rgba(148,163,184,0.16)] bg-[var(--color-panel)] px-2.5 py-1 text-[0.66rem] font-medium text-[var(--color-muted-foreground)]">
          {sourceMeta.label}
        </span>
      </div>

      {center.lastVerifiedAt ? (
        <div className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
          <CheckCircle2 className="h-3.25 w-3.25 text-[var(--color-success)]" />
          <span>Last verified {formatLastVerified(center.lastVerifiedAt)}</span>
        </div>
      ) : null}

      {center.isSample ? (
        <div className="mt-2 flex items-center gap-1.5 text-[0.72rem] text-[var(--color-muted-foreground)]">
          <Database className="h-3.25 w-3.25" />
          <span>Sample/reference record only.</span>
        </div>
      ) : null}
    </article>
  );
}
