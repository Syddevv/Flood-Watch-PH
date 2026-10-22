"use client";

import Link from "next/link";
import { MapPin, Phone } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { EMERGENCY_CONTACT_CATEGORIES } from "@/lib/emergency-contact-categories";
import { EmergencyContactDialog, type AdminContact } from "@/components/emergency-contact-dialog";

const controlClass = "h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm text-[var(--color-foreground)]";

export function AdminEmergencyContactsPage() {
  const [contacts, setContacts] = useState<AdminContact[]>([]);
  const [selected, setSelected] = useState<AdminContact | null>(null);
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), archived: String(archived) });
    if (city) params.set("city", city);
    if (category) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/admin/emergency-contacts?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load contacts.");
        setContacts(payload.data.contacts);
        setTotal(payload.data.total);
        setError(null);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load contacts."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [city, category, search, archived, page, refreshKey]);

  function closeEditor() {
    setSelected(null);
    requestAnimationFrame(() => (editTriggerRef.current?.isConnected ? editTriggerRef.current : searchRef.current)?.focus());
  }

  function savedContact(contact: AdminContact) {
    setContacts((current) => current.map((item) => item.id === contact.id ? contact : item));
    setNotice(`${contact.agencyName} saved.`);
    closeEditor();
    setRefreshKey((value) => value + 1);
  }

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-semibold">Emergency Contacts</h1><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Manage and maintain emergency hotlines across Bulacan.</p></div>
      <Link href="/admin/data" className="text-sm text-[var(--color-primary)] underline">Evacuation centers</Link>
    </header>

    <section aria-label="Contact filters" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto] lg:items-center">
        <input ref={searchRef} aria-label="Search contacts" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search agency or number" className={`${controlClass} min-w-0`} />
        <select aria-label="Locality filter" value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} className={controlClass}><option value="">All localities</option>{BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}</select>
        <select aria-label="Category filter" value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); }} className={controlClass}><option value="">All categories</option>{EMERGENCY_CONTACT_CATEGORIES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select>
        <label className="flex h-10 items-center gap-2 whitespace-nowrap px-2 text-sm"><input type="checkbox" checked={archived} onChange={(event) => { setArchived(event.target.checked); setPage(1); }} />Archived only</label>
      </div>
    </section>

    {error ? <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p> : null}
    {notice ? <p role="status" className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm">{notice}</p> : null}
    {loading ? <p role="status">Loading contacts…</p> : <>
      <p className="text-sm text-[var(--color-muted-foreground)]">{total} {total === 1 ? "contact" : "contacts"}</p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{contacts.map((contact) => <article key={contact.id} className="flex min-w-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm">
        <button type="button" onClick={(event) => { editTriggerRef.current = event.currentTarget; setSelected(contact); setNotice(null); }} className="text-left text-base font-semibold leading-snug hover:text-[var(--color-primary)]">{contact.agencyName}</button>
        <p className="mt-2 flex items-center gap-2 text-sm text-[var(--color-muted-foreground)]"><MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />{contact.city ?? "Bulacan / provincial"}</p>
        <p className="mt-1 flex items-center gap-2 text-sm font-medium"><Phone className="h-4 w-4 shrink-0" aria-hidden="true" />{contact.contactNumber}</p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-4"><div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-muted-foreground)]"><span className="rounded-full border border-[var(--color-border)] px-2 py-1">{contact.category.replaceAll("_", " ")}</span>{contact.duplicateReviewNotes ? <span className="text-[var(--color-warning)]">Possible duplicate</span> : null}</div><button type="button" onClick={(event) => { editTriggerRef.current = event.currentTarget; setSelected(contact); setNotice(null); }} className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-sm font-medium text-[var(--color-primary)] hover:bg-[var(--color-panel)]" aria-label={`Edit ${contact.agencyName}`}>Edit</button></div>
      </article>)}</div>
      {contacts.length === 0 ? <p className="rounded-xl border border-[var(--color-border)] p-6 text-sm text-[var(--color-muted-foreground)]">No contacts match these filters.</p> : null}
      <nav aria-label="Contact pages" className="flex items-center justify-end gap-3 text-sm"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 disabled:opacity-40">Previous</button><span>Page {page}</span><button type="button" disabled={page * 24 >= total} onClick={() => setPage(page + 1)} className="rounded-lg border border-[var(--color-border)] px-3 py-2 disabled:opacity-40">Next</button></nav>
    </>}

    {selected ? <EmergencyContactDialog key={selected.id} contact={selected} onClose={closeEditor} onSaved={savedContact} /> : null}
  </div>;
}
