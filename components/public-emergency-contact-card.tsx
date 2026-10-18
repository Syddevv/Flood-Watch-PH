import type { PublicEmergencyContact } from "@/lib/types";
import { formatLastVerified } from "@/lib/emergency-resources";

export function PublicEmergencyContactCard({ contact }: { contact: PublicEmergencyContact }) {
  return <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <h3 className="font-semibold">{contact.agencyName}</h3>
    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{contact.description ?? contact.category}</p>
    <a href={contact.callHref} className="mt-3 inline-block text-lg font-semibold text-[var(--color-primary)]">{contact.contactNumber}</a>
    <p className="mt-2 text-xs">{contact.isNational ? "National fallback" : contact.city ? `${contact.city}, Bulacan` : "Bulacan provincial"}</p>
    <p className="mt-1 text-xs">{contact.isStale ? "Source needs rechecking" : "Source checked"} {contact.lastSourceCheckedAt ? formatLastVerified(contact.lastSourceCheckedAt) : "date unavailable"}</p>
    {contact.sourceUrl ? <a href={contact.sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-xs text-[var(--color-primary)] underline">Official source</a> : null}
  </article>;
}
