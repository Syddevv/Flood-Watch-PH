"use client";

import type { PublicEmergencyContact } from "@/lib/types";
import { formatLastVerified } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

export function PublicEmergencyContactCard({ contact }: { contact: PublicEmergencyContact }) {
  return <article className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
    <h3 className="font-semibold">{contact.agencyName}</h3>
    <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{contact.description ?? formatUiLabel(contact.category)}</p>
    {contact.preferred ? <p className="mt-2 text-xs font-semibold text-[var(--color-primary)]">Preferred provincial/local listing</p> : null}
    <div className="mt-3 space-y-1">{contact.phones.map((phone, index) => <div key={`${phone.raw}-${index}`} className="flex items-center gap-2">{phone.telUri ? <a href={phone.telUri} className="text-lg font-semibold text-[var(--color-primary)]">{phone.raw}</a> : <><span className="text-lg font-semibold">{phone.raw}</span><button type="button" onClick={() => navigator.clipboard?.writeText(phone.raw)} className="text-xs text-[var(--color-primary)] underline">Copy</button></>}</div>)}</div>
    <p className="mt-2 text-xs">{contact.isNational ? "National fallback" : contact.city ? `${contact.city}, Bulacan` : "Bulacan provincial"}</p>
    <p className="mt-1 text-xs">{contact.sourceFreshness === "undated_directory" ? "Undated directory entry — reconfirm number" : contact.isStale ? "Source needs rechecking" : "Official publication found; number not call-tested"} · Researched {contact.lastSourceCheckedAt ? formatLastVerified(contact.lastSourceCheckedAt) : "date unavailable"}</p>
    {contact.sourceNotes ? <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">{contact.sourceNotes}</p> : null}
    <div className="mt-2 flex flex-wrap gap-2">{contact.sourceLinks.length ? contact.sourceLinks.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-primary)] underline">{source.title}{source.publishedAt ? ` (${source.publishedAt})` : ""}</a>) : contact.sourceUrl ? <a href={contact.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--color-primary)] underline">Official source</a> : null}</div>
  </article>;
}
