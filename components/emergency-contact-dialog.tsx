"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { EMERGENCY_CONTACT_CATEGORIES } from "@/lib/emergency-contact-categories";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { formatUiLabel } from "@/lib/ui-labels";

export type ContactPhone = { raw: string; tel_uri: string | null };
export type AdminContact = {
  id: string; agencyName: string; contactNumber: string; category: string; city: string | null;
  phones: ContactPhone[] | null; sourceKey: string | null; sourceSnapshot: unknown;
  sourceUrl: string | null; lastSourceCheckedAt: string | null; sourceFreshness: string | null;
  verificationStatus: string; preferred: boolean; isArchived: boolean;
  notes: string | null; adminEvidenceUrl: string | null; duplicateReviewNotes: string | null;
  updatedAt: string;
};

type Props = { contact: AdminContact; onClose: () => void; onSaved: (contact: AdminContact) => void };

const fieldClass = "h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]";
const labelClass = "grid gap-1.5 text-sm font-medium text-[var(--color-muted-foreground)]";
const phonePattern = /^[+\d()\s-]{2,40}$/;

function initialPhones(contact: AdminContact): ContactPhone[] {
  return contact.phones?.length ? contact.phones.map((phone) => ({ ...phone })) : [{ raw: contact.contactNumber, tel_uri: null }];
}

export function EmergencyContactDialog({ contact, onClose, onSaved }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const dialLinksRef = useRef<HTMLDetailsElement>(null);
  const [draft, setDraft] = useState<AdminContact>(() => ({ ...contact }));
  const [phones, setPhones] = useState<ContactPhone[]>(() => initialPhones(contact));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  const dirty = JSON.stringify({ draft, phones }) !== JSON.stringify({ draft: contact, phones: initialPhones(contact) });
  const set = <K extends keyof AdminContact>(key: K, value: AdminContact[K]) => setDraft((current) => ({ ...current, [key]: value }));

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm("Discard your unsaved changes?")) return;
    onClose();
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!draft.agencyName.trim()) next.agencyName = "Enter an agency name.";
    if (!EMERGENCY_CONTACT_CATEGORIES.some((category) => category === draft.category)) next.category = "Choose a category.";
    if ((!draft.city && contact.city) || (draft.city && !BULACAN_LOCALITIES.some((locality) => locality.name === draft.city))) next.city = "Choose a Bulacan locality.";
    if (!phones.length) next.phones = "Add at least one contact number.";
    phones.forEach((phone, index) => {
      if (!phone.raw.trim() || !phonePattern.test(phone.raw) || phone.raw.replace(/\D/g, "").length < 3) next[`phone-${index}`] = "Enter a valid mobile, landline, or hotline number.";
      if (phone.tel_uri && !/^tel:(?:\+\d{7,15}|\d{3})$/.test(phone.tel_uri)) next[`reference-${index}`] = "Use a valid tel: link, such as tel:911 or tel:+639171234567.";
    });
    for (const [key, value] of [["sourceUrl", draft.sourceUrl], ["adminEvidenceUrl", draft.adminEvidenceUrl]] as const) {
      if (value && !/^https:\/\/[^\s]+$/i.test(value)) next[key] = "Enter an HTTPS URL.";
    }
    if (next.adminEvidenceUrl && advancedRef.current) advancedRef.current.open = true;
    if (Object.keys(next).some((key) => key.startsWith("reference-")) && dialLinksRef.current) dialLinksRef.current.open = true;
    setFieldErrors(next);
    if (Object.keys(next).length) {
      setError("Review the highlighted fields and try again.");
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ block: "center" }));
    }
    return Object.keys(next).length === 0;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !dirty || !validate()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/emergency-contacts/${contact.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          phones: phones.map((phone) => ({ raw: phone.raw, telUri: phone.tel_uri || null })),
          lastSourceCheckedAt: draft.lastSourceCheckedAt?.slice(0, 10) ?? null,
          expectedUpdatedAt: contact.updatedAt,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save contact.");
      onSaved(payload.data.contact);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save contact.");
    } finally {
      setSaving(false);
    }
  }

  const input = (label: string, key: keyof AdminContact, type = "text") => <label className={labelClass}>
    <span>{label}</span>
    <input className={fieldClass} type={type} value={key === "lastSourceCheckedAt" ? draft.lastSourceCheckedAt?.slice(0, 10) ?? "" : String(draft[key] ?? "")} onChange={(event) => set(key, (key === "agencyName" ? event.target.value : event.target.value || null) as never)} aria-invalid={Boolean(fieldErrors[key])} />
    {fieldErrors[key] ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors[key]}</span> : null}
  </label>;

  return <dialog ref={dialogRef} aria-labelledby="contact-dialog-title" aria-describedby="contact-dialog-description" onCancel={(event) => { event.preventDefault(); requestClose(); }} onClick={(event) => { if (event.target === dialogRef.current) requestClose(); }} className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[44rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-black/70 sm:max-h-[calc(100dvh-2rem)]">
    <form onSubmit={save} noValidate className="flex max-h-[calc(100dvh-1rem)] flex-col sm:max-h-[calc(100dvh-2rem)]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
        <div><h2 id="contact-dialog-title" className="text-lg font-semibold">Edit Emergency Contact</h2><p id="contact-dialog-description" className="mt-1 text-xs text-[var(--color-muted-foreground)]">Update agency information and phone numbers.</p></div>
        <button type="button" aria-label="Close editor" onClick={requestClose} className="rounded p-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"><X className="h-4 w-4" aria-hidden="true" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        <section className="space-y-3" aria-label="Basic information">
          {input("Agency Name", "agencyName")}
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}><span>Category</span><select className={fieldClass} value={draft.category} onChange={(event) => set("category", event.target.value)} aria-invalid={Boolean(fieldErrors.category)}>{EMERGENCY_CONTACT_CATEGORIES.map((category) => <option key={category} value={category}>{formatUiLabel(category)}</option>)}</select>{fieldErrors.category ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors.category}</span> : null}</label>
            <label className={labelClass}><span>City / Municipality</span><select className={fieldClass} value={draft.city ?? ""} onChange={(event) => set("city", event.target.value || null)} aria-invalid={Boolean(fieldErrors.city)}><option value="" disabled={Boolean(contact.city)}>Provincial / not specified</option>{BULACAN_LOCALITIES.map((locality) => <option key={locality.code} value={locality.name}>{locality.name}</option>)}</select>{fieldErrors.city ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors.city}</span> : null}</label>
          </div>
        </section>

        <section className="space-y-3 border-t border-[var(--color-border)] pt-4" aria-labelledby="contact-numbers-title">
          <h3 id="contact-numbers-title" className="text-sm font-semibold">Contact Details</h3>
          {phones.map((phone, index) => <div key={index} className="flex items-start gap-2">
            <label className={`${labelClass} min-w-0 flex-1`}><span>Contact Number {phones.length > 1 ? index + 1 : ""}</span><input className={fieldClass} type="tel" value={phone.raw} onChange={(event) => setPhones((current) => current.map((item, i) => i === index ? { ...item, raw: event.target.value, tel_uri: item.raw === event.target.value ? item.tel_uri : null } : item))} aria-invalid={Boolean(fieldErrors[`phone-${index}`])} />{fieldErrors[`phone-${index}`] ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors[`phone-${index}`]}</span> : null}</label>
            <button type="button" aria-label={`Remove contact number ${index + 1}`} onClick={() => setPhones((current) => current.filter((_, i) => i !== index))} className="mt-7 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-danger)]">Remove</button>
          </div>)}
          {fieldErrors.phones ? <p className="text-xs text-[var(--color-danger)]">{fieldErrors.phones}</p> : null}
          {phones.length < 10 ? <button type="button" onClick={() => setPhones((current) => [...current, { raw: "", tel_uri: null }])} className="text-sm font-medium text-[var(--color-primary)]">+ Add another number</button> : null}
          <details ref={dialLinksRef} className="text-sm"><summary className="cursor-pointer text-[var(--color-muted-foreground)]">Number-specific dial links</summary><div className="mt-3 grid gap-3"><p className="text-xs text-[var(--color-muted-foreground)]">Changing a number clears its previous dial link. Add a new link only after checking it.</p>{phones.map((phone, index) => <label key={index} className={labelClass}><span>Dial link for number {index + 1}</span><input className={fieldClass} value={phone.tel_uri ?? ""} placeholder="tel:+639171234567" onChange={(event) => setPhones((current) => current.map((item, i) => i === index ? { ...item, tel_uri: event.target.value || null } : item))} aria-invalid={Boolean(fieldErrors[`reference-${index}`])} />{fieldErrors[`reference-${index}`] ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors[`reference-${index}`]}</span> : null}</label>)}</div></details>
          {input("Official Source URL (optional)", "sourceUrl", "url")}
        </section>

        <details ref={advancedRef} className="border-t border-[var(--color-border)] pt-4"><summary className="cursor-pointer text-sm font-semibold">Advanced Settings</summary>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={labelClass}><span>Publication / verification state</span><select className={fieldClass} value={draft.verificationStatus} onChange={(event) => set("verificationStatus", event.target.value)}><option value="official_publication_found">Official publication found</option><option value="verified">Number verified</option><option value="needs_verification">Needs verification</option><option value="outdated">Outdated</option></select></label>
            {input("Source researched date", "lastSourceCheckedAt", "date")}
            {input("Source freshness", "sourceFreshness")}
            {input("Correction evidence URL", "adminEvidenceUrl", "url")}
            <div className="sm:col-span-2">{input("Internal correction notes", "notes")}</div>
            <div className="sm:col-span-2">{input("Duplicate review notes", "duplicateReviewNotes")}</div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.preferred} onChange={(event) => set("preferred", event.target.checked)} />Preferred listing</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.isArchived} onChange={(event) => set("isArchived", event.target.checked)} />Hide from public (archive)</label>
          </div>
        </details>

        {contact.sourceKey || contact.sourceSnapshot ? <details className="border-t border-[var(--color-border)] pt-4"><summary className="cursor-pointer text-sm font-semibold">Original Source Information</summary><div className="mt-3 text-xs text-[var(--color-muted-foreground)]">{contact.sourceKey ? <p>Imported reference: {contact.sourceKey}</p> : null}{contact.sourceSnapshot ? <pre className="mt-2 max-h-52 overflow-auto whitespace-pre-wrap break-all">{JSON.stringify(contact.sourceSnapshot, null, 2)}</pre> : null}</div></details> : null}
      </div>

      <footer className="shrink-0 border-t border-[var(--color-border)] px-5 py-4 sm:px-6">{error ? <p role="alert" className="mb-3 text-sm text-[var(--color-danger)]">{error} Your edits are still here.</p> : null}<div className="flex justify-end gap-2"><button type="button" onClick={requestClose} disabled={saving} className="rounded-lg bg-[var(--color-panel)] px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || !dirty} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button></div></footer>
    </form>
  </dialog>;
}
