"use client";

import { Phone, ShieldCheck, Waves } from "lucide-react";

import { useEmergencyContacts } from "@/components/use-emergency-contacts";
import { PublicEmergencyContactCard } from "@/components/public-emergency-contact-card";
import {
  RESCUE_DISCLAIMER,
  RESCUE_HOTLINE_NOTICE,
  RESCUE_WAIT_TIPS,
} from "@/lib/rescue-request-data";

/**
 * Static support column for the Request Rescue view: what to do while waiting,
 * who to call, and what this tool is not. Rendered beside the form on large
 * screens and stacked underneath the request list on small ones.
 */
export function RescueRequestAside() {
  const { contacts, loading, error } = useEmergencyContacts();
  const hotlines = [...contacts.filter((contact) => !contact.isNational).slice(0, 3), ...contacts.filter((contact) => contact.isNational).slice(0, 1)];
  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-[var(--color-foreground)]">
          <ShieldCheck className="h-4 w-4 shrink-0 text-[var(--color-success)]" />
          <span>While you wait</span>
        </h2>

        <ul className="mt-3 flex flex-col gap-3">
          {RESCUE_WAIT_TIPS.map((tip) => (
            <li key={tip} className="flex items-start gap-2.5">
              <Waves className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span className="text-[0.86rem] leading-6 text-[var(--color-foreground)]">
                {tip}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[var(--color-danger-border)] bg-[color:color-mix(in_srgb,var(--color-danger)_6%,var(--color-surface))] p-4 shadow-[var(--shadow-soft)]">
        <h2 className="flex items-center gap-2 text-[0.95rem] font-semibold text-[var(--color-danger)]">
          <Phone className="h-4 w-4 shrink-0" />
          <span>Emergency hotlines</span>
        </h2>

        <div className="mt-3 flex flex-col gap-2">{hotlines.map((hotline) => <PublicEmergencyContactCard key={hotline.id} contact={hotline} />)}</div>

        {loading ? <p role="status" className="mt-3 text-sm">Loading verified numbers…</p> : error ? <p role="alert" className="mt-3 text-sm">{error}</p> : hotlines.length === 0 ? <p className="mt-3 text-sm">No verified contact numbers are available here right now.</p> : null}

        <p className="mt-3 text-[0.78rem] leading-5 text-[var(--color-danger)]">
          {RESCUE_HOTLINE_NOTICE}
        </p>
      </section>

      <section className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_78%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4">
        <p className="text-[0.78rem] leading-5 text-[var(--color-muted-foreground)]">
          {RESCUE_DISCLAIMER}
        </p>
      </section>
    </div>
  );
}
