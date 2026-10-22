"use client";

import { ChevronDown, Phone, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { useEmergencyContacts } from "@/components/use-emergency-contacts";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { matchesContactGroup, resolveContactGroups, type ContactGroup } from "@/lib/emergency-contact-directory";
import { formatLastVerified } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

const inputClass = "min-h-12 w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-lg text-[var(--color-foreground)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
const outlineButton = "inline-flex min-h-12 items-center justify-center rounded-xl border border-[var(--color-border)] px-5 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
const callButton = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 text-lg font-bold text-white focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";

function coverage(group: ContactGroup) {
  return group.primary.isNational ? "National" : group.primary.city ?? "Bulacan-wide";
}

function serviceLabel(category: string) {
  return formatUiLabel(category);
}

function PhoneAction({ phone, agency, prominent = false }: {
  phone: { raw: string; telUri: string | null }; agency: string; prominent?: boolean;
}) {
  const [message, setMessage] = useState("");
  const className = prominent ? callButton : outlineButton;
  if (phone.telUri && /^tel:(?:\+\d{7,15}|\d{3})$/.test(phone.telUri)) {
    return <a href={phone.telUri} aria-label={`Call ${agency} at ${phone.raw}`} className={className}><Phone aria-hidden="true" className="h-5 w-5" />Call</a>;
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(phone.raw);
      setMessage("Number copied.");
    } catch {
      setMessage("Could not copy. Select the number to copy it.");
    }
  }
  return <div className="grid gap-1">
    <button type="button" onClick={copy} aria-label={`Copy number for ${agency}: ${phone.raw}`} className={className}>Copy number</button>
    {message ? <span role="status" className="text-base">{message}</span> : null}
  </div>;
}

function ContactCard({ group, onDetails }: { group: ContactGroup; onDetails: (trigger: HTMLButtonElement) => void }) {
  const phone = group.numbers[0];
  return <article className="flex min-w-0 flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-sm sm:p-6">
    <h3 className="text-xl font-bold leading-snug wrap-break-word">{group.primary.agencyName}</h3>
    <p className="mt-2 text-lg">{coverage(group)}</p>
    {phone ? <p className="mt-4 text-2xl font-bold leading-snug text-[var(--color-primary)] break-all select-text">{phone.raw}</p>
      : <p className="mt-4 text-lg">No published number available.</p>}
    <div className="mt-auto flex flex-wrap items-center gap-3 pt-5">
      {phone ? <PhoneAction phone={phone} agency={group.primary.agencyName} prominent={Boolean(phone.telUri)} /> : null}
      <button type="button" onClick={(event) => onDetails(event.currentTarget)} aria-label={`View details for ${group.primary.agencyName}`} className={outlineButton}>View details</button>
    </div>
    {group.numbers.length > 1 ? <button type="button" onClick={(event) => onDetails(event.currentTarget)} className="mt-3 inline-flex min-h-12 w-fit items-center text-left text-lg font-semibold text-[var(--color-primary)] underline underline-offset-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">More numbers</button> : null}
  </article>;
}

export function EmergencyHotlinesContent() {
  const { contacts, loading, error, refresh } = useEmergencyContacts(true);
  const [municipality, setMunicipality] = useState("");
  const [category, setCategory] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const groups = useMemo(() => resolveContactGroups(contacts), [contacts]);
  const selected = groups.find((group) => group.id === selectedId) ?? null;
  const categories = useMemo(() => [...new Set(contacts.filter((contact) => !contact.isNational).map((contact) => contact.category))].sort(), [contacts]);
  const matches = (group: ContactGroup) => matchesContactGroup(group, query, category);
  const preferredProvincial = groups.filter((group) => !group.primary.isNational && !group.primary.city && group.primary.preferred);
  const otherProvincial = groups.filter((group) => !group.primary.isNational && !group.primary.city && !group.primary.preferred && matches(group));
  const local = groups.filter((group) => !group.primary.isNational && group.primary.city &&
    (!municipality || group.primary.city === municipality) && matches(group));
  const national = groups.filter((group) => group.primary.isNational && matches(group));
  const hasFilters = Boolean(municipality || category || query.trim());

  useEffect(() => {
    const dialog = dialogRef.current;
    if (selected && dialog && !dialog.open) {
      dialog.showModal();
      closeRef.current?.focus();
    }
  }, [selected]);

  function openDetails(id: string, trigger: HTMLButtonElement) {
    triggerRef.current = trigger;
    setSelectedId(id);
  }

  const card = (group: ContactGroup) => <ContactCard key={group.id} group={group} onDetails={(trigger) => openDetails(group.id, trigger)} />;

  return <main className="mx-auto w-full max-w-6xl space-y-7 px-4 py-6 pb-24 md:px-8 md:py-8">
    <header>
      <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Emergency Contacts</h1>
      <p className="mt-2 text-lg leading-relaxed">Find emergency help in Bulacan.</p>
    </header>

    {loading ? <p role="status" className="text-lg">Loading contacts…</p> : error ? <div role="alert" className="space-y-3 text-lg"><p>Unable to load contacts. Please try again.</p><button type="button" onClick={refresh} className={outlineButton}>Retry</button></div> : <>
      <section aria-labelledby="emergency-help-heading" className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 sm:p-6">
        <h2 id="emergency-help-heading" className="text-2xl font-bold">Emergency help</h2>
        <p className="mt-2 text-lg">For immediate danger, use a preferred Bulacan-wide contact. Published numbers are not call-tested.</p>
        {preferredProvincial.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{preferredProvincial.map(card)}</div>
          : <p className="mt-4 text-lg">No preferred provincial contact is listed. Check with your local DRRMO.</p>}
      </section>

      <div className="grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-lg font-semibold">Municipality or city
          <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className={inputClass}>
            <option value="">All municipalities</option>
            {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
          </select>
        </label>
        <label className="grid gap-2 text-lg font-semibold">Search agency or service
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} />
        </label>
      </div>

      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
        <summary className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-4 text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">More filters<ChevronDown aria-hidden="true" className="ml-auto h-5 w-5" /></summary>
        <div className="border-t border-[var(--color-border)] p-4"><label className="grid gap-2 text-lg font-medium">Service category
          <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}><option value="">All services</option>{categories.map((value) => <option key={value} value={value}>{serviceLabel(value)}</option>)}</select>
        </label></div>
      </details>
      {hasFilters ? <button type="button" onClick={() => { setMunicipality(""); setCategory(""); setQuery(""); }} className={outlineButton}>Clear filters</button> : null}

      <section aria-labelledby="local-contacts-heading">
        <h2 id="local-contacts-heading" className="text-2xl font-bold">{municipality || "Local contacts"}</h2>
        {local.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{local.map(card)}</div>
          : <p className="mt-4 rounded-xl border border-dashed border-[var(--color-border)] p-5 text-lg">No local contacts match. Try another municipality or clear the filters.</p>}
      </section>

      <section aria-labelledby="provincial-contacts-heading">
        <h2 id="provincial-contacts-heading" className="text-2xl font-bold">Other Bulacan-wide contacts</h2>
        {otherProvincial.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{otherProvincial.map(card)}</div>
          : <p className="mt-4 text-lg">No other Bulacan-wide contacts match.</p>}
      </section>

      <section aria-labelledby="national-contacts-heading">
        <h2 id="national-contacts-heading" className="text-2xl font-bold">National emergency contacts</h2>
        {national.length ? <div className="mt-4 grid gap-4 lg:grid-cols-2">{national.map(card)}</div>
          : <p className="mt-4 text-lg">No national contact matches or is currently listed.</p>}
      </section>
      <button type="button" onClick={refresh} className={outlineButton}>Refresh contacts</button>
    </>}

    {selected ? <dialog ref={dialogRef} aria-labelledby="contact-detail-title" onClose={() => { setSelectedId(null); triggerRef.current?.focus(); }} className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto overscroll-contain rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-slate-950/70">
      <div className="p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <h2 id="contact-detail-title" className="text-2xl font-bold leading-snug wrap-break-word">{selected.primary.agencyName}</h2>
          <button ref={closeRef} type="button" onClick={() => dialogRef.current?.close()} aria-label="Close details" className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-xl border border-[var(--color-border)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><X aria-hidden="true" className="h-6 w-6" /></button>
        </div>
        <p className="mt-3 text-lg">{serviceLabel(selected.primary.category)} · {coverage(selected)}</p>
        {selected.primary.description ? <p className="mt-3 text-lg">{selected.primary.description}</p> : null}
        <h3 className="mt-6 text-xl font-bold">Published numbers</h3>
        {selected.numbers.length ? <div className="mt-3 space-y-3">{selected.numbers.map((phone) => <div key={`${phone.from.id}-${phone.raw}`} className="rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-xl font-bold break-all select-text">{phone.raw}</p>
          {phone.from.id !== selected.primary.id || phone.from.sourceFreshness === "undated_directory" ? <p className="mt-1 text-base">{phone.from.sourceFreshness === "undated_directory" ? "Older published listing — this number may need updating." : `Also published for ${phone.from.agencyName}. Number not call-tested.`}</p> : null}
          <div className="mt-3"><PhoneAction phone={phone} agency={phone.from.agencyName} /></div>
        </div>)}</div> : <p className="mt-2 text-lg">No published number available.</p>}
        {[...new Set(selected.records.flatMap((record) => record.emails))].map((email) => <p key={email} className="mt-5 text-lg break-all"><span className="font-semibold">Public email:</span> <a href={`mailto:${email}`} className="inline-flex min-h-12 items-center text-[var(--color-primary)] underline">{email}</a></p>)}
        {[...new Set(selected.records.map((record) => record.sourceNotes).filter((note): note is string => Boolean(note)))].map((note) => <p key={note} className="mt-5 text-lg leading-relaxed">{note}</p>)}
        <details className="mt-6 border-t border-[var(--color-border)] pt-3">
          <summary className="flex min-h-12 cursor-pointer items-center text-lg font-semibold focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">Sources and updates</summary>
          <div className="space-y-3 pb-3 text-base leading-relaxed">
            <p>These are published contacts, not confirmed live phone lines. Source research dates do not confirm a number is reachable.</p>
            {selected.records.map((record) => <div key={record.id} className="space-y-2 border-t border-[var(--color-border)] pt-3">
              <p className="font-semibold">{record.agencyName}{record.sourceFreshness === "undated_directory" ? " — older directory" : ""}</p>
              {record.isStale ? <p>This published number may need updating.</p> : null}
              {record.lastSourceCheckedAt ? <p>Source researched {formatLastVerified(record.lastSourceCheckedAt)}.</p> : <p>Source date unavailable.</p>}
              {record.sourceLinks.length ? <ul className="space-y-2">{record.sourceLinks.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center text-[var(--color-primary)] underline underline-offset-2">{source.title}{source.publishedAt ? ` (${source.publishedAt})` : ""}</a></li>)}</ul>
                : record.sourceUrl ? <a href={record.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center text-[var(--color-primary)] underline">Published source</a> : null}
            </div>)}
          </div>
        </details>
      </div>
    </dialog> : null}
  </main>;
}
