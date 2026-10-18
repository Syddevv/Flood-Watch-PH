"use client";

import { useMemo, useState } from "react";

import { PublicEmergencyContactCard } from "@/components/public-emergency-contact-card";
import { useEmergencyContacts } from "@/components/use-emergency-contacts";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";

export function EmergencyHotlinesContent() {
  const { contacts, loading, error, refresh } = useEmergencyContacts();
  const [municipality, setMunicipality] = useState("");
  const [query, setQuery] = useState("");
  const localContacts = useMemo(() => contacts.filter((contact) => !contact.isNational &&
    (!municipality || !contact.city || contact.city === municipality) &&
    (!query || `${contact.agencyName} ${contact.description ?? ""} ${contact.contactNumber}`.toLowerCase().includes(query.toLowerCase()))),
  [contacts, municipality, query]);
  const nationalContacts = useMemo(() => contacts.filter((contact) => contact.isNational), [contacts]);

  return <main className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 md:px-8">
    <header>
      <h1 className="text-3xl font-semibold">Bulacan emergency contacts</h1>
      <p className="mt-2 max-w-3xl text-sm text-[var(--color-muted-foreground)]">Numbers are displayed only with an official source and check date. For life-threatening emergencies, use the verified national fallback below when available. Confirm local contact details with the responsible office when possible.</p>
    </header>
    <div className="flex flex-wrap gap-3">
      <label className="grid gap-1 text-sm">Municipality or city
        <select value={municipality} onChange={(event) => setMunicipality(event.target.value)} className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3">
          <option value="">All of Bulacan</option>
          {BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}
        </select>
      </label>
      <label className="grid gap-1 text-sm">Search
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} className="h-11 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" placeholder="Office or number" />
      </label>
      <button type="button" onClick={refresh} className="self-end rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm">Refresh contacts</button>
    </div>
    {loading ? <p role="status">Loading verified contacts…</p> : error ? <p role="alert">{error}</p> : (
      <>
        <section>
          <h2 className="text-xl font-semibold">Bulacan provincial and local contacts</h2>
          {localContacts.length ? <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{localContacts.map((contact) => <PublicEmergencyContactCard key={contact.id} contact={contact} />)}</div> : <p className="mt-3 rounded-xl border border-dashed border-[var(--color-border)] p-6 text-sm">No verified local contact is recorded{municipality ? ` for ${municipality}` : " for this selection"}. Ask your LGU for its current emergency number.</p>}
        </section>
        <section>
          <h2 className="text-xl font-semibold">National emergency fallback</h2>
          {nationalContacts.length ? <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{nationalContacts.map((contact) => <PublicEmergencyContactCard key={contact.id} contact={contact} />)}</div> : <p className="mt-3 text-sm">No verified national fallback is currently recorded.</p>}
        </section>
      </>
    )}
  </main>;
}
