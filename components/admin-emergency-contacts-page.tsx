"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";

type Phone = { raw: string; tel_uri: string | null };
type Contact = {
  id: string; agencyName: string; contactNumber: string; category: string; city: string | null;
  phones: Phone[] | null; sourceKey: string | null; sourceSnapshot: unknown;
  sourceUrl: string | null; lastSourceCheckedAt: string | null; sourceFreshness: string | null;
  verificationStatus: string; preferred: boolean; isArchived: boolean;
  notes: string | null; adminEvidenceUrl: string | null; duplicateReviewNotes: string | null;
  updatedAt: string;
};

export function AdminEmergencyContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selected, setSelected] = useState<Contact | null>(null);
  const [phones, setPhones] = useState<Phone[]>([]);
  const [city, setCity] = useState("");
  const [search, setSearch] = useState("");
  const [archived, setArchived] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), archived: String(archived) });
    if (city) params.set("city", city);
    if (search.trim()) params.set("search", search.trim());
    fetch(`/api/admin/emergency-contacts?${params}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => { const payload = await response.json(); if (!response.ok) throw new Error(payload.error ?? "Unable to load contacts."); setContacts(payload.data.contacts); setTotal(payload.data.total); })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load contacts."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [city, search, archived, page, refreshKey]);

  const choose = (contact: Contact) => { setSelected(contact); setPhones(contact.phones?.length ? contact.phones : [{ raw: contact.contactNumber, tel_uri: null }]); setError(null); setNotice(null); };
  const set = <K extends keyof Contact>(key: K, value: Contact[K]) => setSelected((current) => current ? { ...current, [key]: value } : null);
  const input = (label: string, key: keyof Contact, type = "text") => <label className="grid gap-1 text-sm"><span>{label}</span><input type={type} value={key === "lastSourceCheckedAt" ? selected?.lastSourceCheckedAt?.slice(0, 10) ?? "" : String(selected?.[key] ?? "")} onChange={(event) => set(key, event.target.value as never)} className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" /></label>;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || saving) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch(`/api/admin/emergency-contacts/${selected.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...selected, phones: phones.map((phone) => ({ raw: phone.raw, telUri: phone.tel_uri || null })),
        lastSourceCheckedAt: selected.lastSourceCheckedAt?.slice(0, 10) ?? null,
        expectedUpdatedAt: selected.updatedAt,
      }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save contact.");
      choose(payload.data.contact); setNotice("Contact saved. Public views update after refresh.");
      setRefreshKey((value) => value + 1);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save contact."); }
    finally { setSaving(false); }
  }

  return <div className="space-y-5">
    <header><h1 className="text-3xl font-semibold">Emergency contacts</h1><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Correct imported entries without changing their source snapshots.</p><Link href="/admin/data" className="text-sm text-[var(--color-primary)] underline">Evacuation centers</Link></header>
    <div className="flex flex-wrap gap-2 text-sm">
      <input aria-label="Search contacts" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Agency or number" className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" />
      <select aria-label="Municipality" value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><option value="">All localities</option>{BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}</select>
      <label className="flex items-center gap-1"><input type="checkbox" checked={archived} onChange={(event) => { setArchived(event.target.checked); setPage(1); }} />Archived</label>
    </div>
    {error ? <p role="alert" className="text-[var(--color-danger)]">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    {loading ? <p role="status">Loading contacts…</p> : <><p className="text-sm">{total} records</p><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{contacts.map((contact) => <button type="button" key={contact.id} onClick={() => choose(contact)} className="rounded-lg border border-[var(--color-border)] p-3 text-left text-sm"><strong>{contact.agencyName}</strong><span className="block">{contact.city ?? "Provincial"} · {contact.category.replaceAll("_", " ")}</span>{contact.duplicateReviewNotes ? <span className="block text-[var(--color-warning)]">Potential duplicate</span> : null}</button>)}</div><div className="flex gap-3 text-sm"><button disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page}</span><button disabled={page * 24 >= total} onClick={() => setPage(page + 1)}>Next</button></div></>}
    {selected ? <form onSubmit={save} className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 md:grid-cols-2">
      <h2 className="text-xl font-semibold md:col-span-2">Edit {selected.agencyName}</h2>
      <p className="text-xs md:col-span-2">{selected.sourceKey ? `Imported key: ${selected.sourceKey}.` : "Administrator/legacy record."} Corrections survive reimport.</p>
      {selected.sourceSnapshot ? <details className="md:col-span-2"><summary>Original source values and references</summary><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(selected.sourceSnapshot, null, 2)}</pre></details> : null}
      {input("Agency", "agencyName")}{input("Category", "category")}
      <label className="grid gap-1 text-sm">Locality<select value={selected.city ?? ""} onChange={(event) => set("city", event.target.value || null)} className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><option value="">Provincial</option>{BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Publication state<select value={selected.verificationStatus} onChange={(event) => set("verificationStatus", event.target.value)} className="h-10 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3"><option value="official_publication_found">Official publication found</option><option value="verified">Verified</option><option value="needs_verification">Needs verification</option><option value="outdated">Outdated</option></select></label>
      {phones.map((phone, index) => <div key={index} className="grid gap-1 text-sm"><label>Raw number<input value={phone.raw} onChange={(event) => setPhones((current) => current.map((item, i) => i === index ? { ...item, raw: event.target.value } : item))} className="block h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" /></label><label>Supplied tel URI (optional)<input value={phone.tel_uri ?? ""} onChange={(event) => setPhones((current) => current.map((item, i) => i === index ? { ...item, tel_uri: event.target.value || null } : item))} className="block h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" /></label><button type="button" onClick={() => setPhones((current) => current.filter((_, i) => i !== index))} className="text-left text-xs text-[var(--color-danger)]">Remove number</button></div>)}
      <button type="button" onClick={() => setPhones((current) => [...current, { raw: "", tel_uri: null }])} className="text-left text-sm text-[var(--color-primary)]">Add number</button>
      {input("Official source URL", "sourceUrl", "url")}{input("Source researched date", "lastSourceCheckedAt", "date")}
      {input("Source freshness", "sourceFreshness")}{input("Correction evidence URL", "adminEvidenceUrl", "url")}
      {input("Internal correction notes", "notes")}{input("Duplicate review notes", "duplicateReviewNotes")}
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.preferred} onChange={(event) => set("preferred", event.target.checked)} />Preferred listing</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={selected.isArchived} onChange={(event) => set("isArchived", event.target.checked)} />Hide from public (archive)</label>
      <button disabled={saving} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 font-semibold text-white">{saving ? "Saving…" : "Save contact"}</button>
    </form> : null}
  </div>;
}
