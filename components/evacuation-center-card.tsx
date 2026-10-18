import { MapPinned } from "lucide-react";

import type { PublicEvacuationCenter } from "@/lib/types";
import { centerListingLabel, centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";

export function EvacuationCenterCard({
  center,
}: {
  center: PublicEvacuationCenter;
}) {
  const listing = centerListingLabel(center);
  const opening = centerOpeningLabel(center);

  return (
    <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h3 className="text-base font-semibold leading-snug">{center.name}</h3>
      <p className="mt-2 flex items-start gap-2 text-sm"><MapPinned aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />{[center.barangay, center.city].filter(Boolean).join(", ")}</p>
      <p className="mt-2 text-sm font-semibold">{center.openingStatus === "unknown" && listing ? listing : opening}</p>
      {center.openingStatus === "unknown" ? <p className="mt-1 text-sm">Check opening before going.</p> : center.availabilityConfirmedAt ? <p className="mt-1 text-sm">Updated {formatOperationalUpdate(center.availabilityConfirmedAt)}</p> : null}
    </article>
  );
}
