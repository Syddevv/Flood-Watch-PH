import { Check, Clock, MapPin, Radio, Users } from "lucide-react";

import {
  RESCUE_ASSISTANCE_TAGS,
  type RescueRequestRecord,
} from "@/lib/rescue-request-data";
import { formatRescuePeopleLabel } from "@/lib/rescue-request-form";
import { cn } from "@/lib/utils";

type RescueRequestCardProps = {
  request: RescueRequestRecord;
};

function describeTagLabels(request: RescueRequestRecord) {
  return RESCUE_ASSISTANCE_TAGS.filter((tag) =>
    request.assistanceTagIds.includes(tag.id),
  );
}

/**
 * One filed request: who and where, followed by the five-stage timeline.
 *
 * The last stamped stage is the current one; everything after it is pending.
 * That is derived here rather than stored, so a record can never disagree with
 * itself about which stage it is on.
 */
export function RescueRequestCard({ request }: RescueRequestCardProps) {
  const lastCompletedIndex = request.timeline.reduce(
    (latest, entry, index) => (entry.time ? index : latest),
    -1,
  );
  const tags = describeTagLabels(request);

  return (
    <article className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)] sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="font-mono text-[0.78rem] font-semibold tracking-[0.04em] text-[var(--color-muted-foreground)]">
          {request.id}
        </p>

        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-[0.72rem] font-semibold",
            request.complete
              ? "bg-[var(--color-success-surface)] text-[var(--color-success-text)]"
              : "bg-[var(--color-primary)] text-white",
          )}
        >
          {request.statusLabel}
        </span>
      </div>

      <h3 className="mt-2 flex items-start gap-2 text-[0.95rem] font-semibold text-[var(--color-foreground)]">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="min-w-0">{request.locationName}</span>
      </h3>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[0.78rem] text-[var(--color-muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 shrink-0" />
          {formatRescuePeopleLabel(request.peopleCount)}
        </span>

        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {request.submittedLabel}
        </span>

        {request.assignedTeam ? (
          <span className="inline-flex items-center gap-1.5">
            <Radio className="h-3.5 w-3.5 shrink-0" />
            {request.assignedTeam}
          </span>
        ) : null}
      </div>

      {tags.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <li
              key={tag.id}
              className="rounded-full border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_78%,transparent)] px-2.5 py-1 text-[0.72rem] font-medium text-[var(--color-foreground)]"
            >
              {tag.label}
            </li>
          ))}
        </ul>
      ) : null}

      <p className="mt-3 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
        {request.description}
      </p>

      <section className="mt-4 rounded-[var(--radius-panel)] border border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_60%,transparent)] p-3.5 sm:p-4">
        <h4 className="text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-[var(--color-muted-foreground)]">
          Status timeline
        </h4>

        <ol className="mt-3">
          {request.timeline.map((entry, index) => {
            const done = entry.time !== null;
            const current = index === lastCompletedIndex;
            const isLast = index === request.timeline.length - 1;

            return (
              <li key={entry.stage} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border",
                      current
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white"
                        : done
                          ? "border-[var(--color-warning)] bg-[var(--color-warning)] text-white"
                          : "border-[color:color-mix(in_srgb,var(--color-muted-foreground)_46%,transparent)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)]",
                    )}
                  >
                    {done ? (
                      <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                    )}
                  </span>

                  {isLast ? null : (
                    <span
                      className={cn(
                        "w-px flex-1",
                        done
                          ? "bg-[var(--color-warning)]"
                          : "bg-[color:color-mix(in_srgb,var(--color-muted-foreground)_32%,transparent)]",
                      )}
                    />
                  )}
                </div>

                <div className={cn("min-w-0", isLast ? "pb-0" : "pb-4")}>
                  <p
                    className={cn(
                      "text-[0.86rem] font-semibold",
                      done
                        ? "text-[var(--color-foreground)]"
                        : "text-[var(--color-muted-foreground)]",
                    )}
                  >
                    {entry.stage}
                  </p>

                  <p className="mt-0.5 text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
                    {entry.time ? (
                      <>
                        {entry.time}
                        {entry.detail ? ` — ${entry.detail}` : null}
                      </>
                    ) : (
                      "Pending"
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </article>
  );
}
