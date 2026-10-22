import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { rescueStatusLabel, type RescueRecord } from "@/lib/rescue-request-client";
import { formatRescuePeopleLabel } from "@/lib/rescue-request-form";

export function RescueRequestCard({ request }: { request: RescueRecord }) {
  return <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <p className="font-mono text-sm font-semibold">{request.reference}</p>
      <span className="rounded-full border border-[var(--color-border)] px-2.5 py-1 text-xs font-semibold">{rescueStatusLabel(request.status, request.workflowVersion)}</span>
    </div>
    <p className="mt-3 flex items-start gap-2 text-sm"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{request.locationName}, {request.barangay}</p>
    <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]"><Users className="h-4 w-4" />{formatRescuePeopleLabel(request.peopleCount)} · Received {new Date(request.createdAt).toLocaleString("en-PH")}</p>
    <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Last updated {new Date(request.updatedAt).toLocaleString("en-PH")}</p>
    <Link href={`/rescue-request/${encodeURIComponent(request.id)}`} className="mt-3 inline-block rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--color-panel)]">View request and updates</Link>
  </article>;
}
