"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { MapPin, Plus, Search, X } from "lucide-react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RESPONDER_CAPABILITIES, RESPONDER_TYPES, responderCapabilityLabel } from "@/lib/responder-options";

type Organization = {
  id: string; name: string; type: string; homeLocalityCode: string; coverageLocalityCodes: string[];
  capabilityCodes: string[]; contactOffice: string | null; contactPerson: string | null;
  officialPhone: string | null; secondaryContact: string | null; preferredChannel: string | null;
  availability: string; active: boolean; lastContactVerifiedAt: string | null; demo: boolean;
};
type Draft = {
  name: string; type: string; homeLocalityCode: string; coverageLocalityCodes: string[];
  capabilityCodes: string[]; contactOffice: string; contactPerson: string; officialPhone: string;
  secondaryContact: string; preferredChannel: string; availability: string; active: boolean;
  demo: boolean; contactVerified: boolean;
};
const emptyDraft: Draft = {
  name: "", type: "municipal_office", homeLocalityCode: "", coverageLocalityCodes: [],
  capabilityCodes: [], contactOffice: "", contactPerson: "", officialPhone: "",
  secondaryContact: "", preferredChannel: "", availability: "unknown", active: true,
  demo: true, contactVerified: false,
};
const draftFrom = (row: Organization): Draft => ({
  ...row, contactOffice: row.contactOffice ?? "", contactPerson: row.contactPerson ?? "",
  officialPhone: row.officialPhone ?? "", secondaryContact: row.secondaryContact ?? "",
  preferredChannel: row.preferredChannel ?? "", contactVerified: false,
});
const field = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2.5 text-sm outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/15";
const localityName = (code: string) => BULACAN_LOCALITIES.find((place) => place.code === code)?.name ?? code;
const availabilityLabel = (value: string) => value === "unknown" ? "Unknown" : value.charAt(0).toUpperCase() + value.slice(1);

function LocalityPicker({ id, label, selected, excluded, onSelect, error }: {
  id: string; label: string; selected?: string; excluded?: string[]; onSelect: (code: string) => void; error?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const choices = BULACAN_LOCALITIES.filter((place) => !excluded?.includes(place.code) && place.name.toLowerCase().includes(query.toLowerCase())).slice(0, 12);
  function choose(code: string) { onSelect(code); setQuery(""); setOpen(false); setActive(0); }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") { setOpen(false); event.stopPropagation(); return; }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault(); setOpen(true);
      setActive((index) => choices.length ? (index + (event.key === "ArrowDown" ? 1 : -1) + choices.length) % choices.length : 0);
    }
    if (event.key === "Enter" && open && choices[active]) { event.preventDefault(); choose(choices[active].code); }
  }
  return <div className="relative min-w-0">
    <label htmlFor={id} className="text-sm font-medium">{label}</label>
    <input id={id} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && choices[active] ? `${id}-option-${choices[active].code}` : undefined} aria-invalid={Boolean(error)} value={query} onChange={(event) => { setQuery(event.target.value); setActive(0); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)} onKeyDown={onKeyDown} placeholder="Search Bulacan municipality" autoComplete="off" className={field} />
    {open && <div id={`${id}-options`} role="listbox" className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1 shadow-xl">
      {choices.length ? choices.map((place, index) => <button key={place.code} id={`${id}-option-${place.code}`} type="button" role="option" aria-selected={index === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(place.code)} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${index === active ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "hover:bg-[var(--color-panel)]"}`}>{place.name}</button>) : <p className="px-3 py-2 text-sm text-[var(--color-muted-foreground)]">No matching municipality.</p>}
    </div>}
    {selected && <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Selected: {localityName(selected)}</p>}
    {error && <p className="mt-1 text-xs text-[var(--color-danger)]">{error}</p>}
  </div>;
}

function OrganizationModal({ organization, onClose, onSaved }: {
  organization: Organization | null; onClose: () => void; onSaved: (row: Organization) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => organization ? draftFrom(organization) : emptyDraft);
  const [loading, setLoading] = useState(Boolean(organization));
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState(() => JSON.stringify(organization ? draftFrom(organization) : emptyDraft));
  const dialogRef = useRef<HTMLDivElement>(null);
  const savedRef = useRef(false);
  const dirty = JSON.stringify(draft) !== baseline;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timer = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>('button[aria-label="Close organization form"]')?.focus(), 0);
    return () => { window.clearTimeout(timer); document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  useEffect(() => {
    if (!organization) return;
    const controller = new AbortController();
    void fetch(`/api/admin/responders/${encodeURIComponent(organization.id)}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
      const body = await response.json() as { data?: Organization; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not load this organization.");
      const next = draftFrom(body.data);
      setBaseline(JSON.stringify(next)); setDraft(next);
    }).catch((cause) => { if (!controller.signal.aborted) { setLoadFailed(true); setError(cause instanceof Error ? cause.message : "Could not load this organization."); } }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [organization, loadKey]);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: "" }));
  }
  function close() {
    if (busy) return;
    if (dirty && !savedRef.current && !window.confirm("Discard unsaved organization changes?")) return;
    onClose();
  }
  function onDialogKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? [])].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0]; const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadFailed) return;
    const errors: Record<string, string> = {};
    if (!draft.name.trim()) errors.name = "Enter an organization name.";
    if (!draft.homeLocalityCode) errors.homeLocalityCode = "Choose a Bulacan municipality.";
    if (draft.contactVerified && !draft.officialPhone.trim() && !draft.secondaryContact.trim()) errors.officialPhone = "Record a contact method before confirming it was checked.";
    if (draft.contactVerified && !draft.officialPhone.trim() && !draft.secondaryContact.trim()) errors.officialPhone = "Record a contact method before confirming it was checked.";
    if (draft.availability === "available" && !draft.officialPhone.trim() && !draft.secondaryContact.trim()) errors.officialPhone = "Record a contact method before marking available.";
    if (draft.availability === "available" && !organization?.lastContactVerifiedAt && !draft.contactVerified) errors.contactVerified = "Confirm that the contact information was checked.";
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    if (organization?.active && !draft.active && !window.confirm("Deactivate this organization? Historical assignments will remain, but it cannot be selected for new requests.")) return;
    setBusy(true); setError(""); setFieldErrors({});
    try {
      const payload = {
        name: draft.name.trim(), type: draft.type, homeLocalityCode: draft.homeLocalityCode,
        coverageLocalityCodes: [...new Set([...draft.coverageLocalityCodes, draft.homeLocalityCode])],
        capabilityCodes: draft.capabilityCodes, contactOffice: draft.contactOffice.trim() || null,
        contactPerson: draft.contactPerson.trim() || null, officialPhone: draft.officialPhone.trim() || null,
        secondaryContact: draft.secondaryContact.trim() || null, preferredChannel: draft.preferredChannel || null,
        availability: draft.availability, contactVerified: draft.contactVerified, demo: draft.demo,
        ...(organization ? { active: draft.active } : {}),
      };
      const response = await fetch(organization ? `/api/admin/responders/${encodeURIComponent(organization.id)}` : "/api/admin/responders", {
        method: organization ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify(payload),
      });
      const body = await response.json() as { data?: Organization; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not save this organization.");
      savedRef.current = true;
      onSaved(body.data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this organization."); }
    finally { setBusy(false); }
  }

  const typeOptions = RESPONDER_TYPES.some((option) => option.code === draft.type) ? RESPONDER_TYPES : [...RESPONDER_TYPES, { code: draft.type, label: draft.type.replaceAll("_", " ") }];
  const knownCodes = new Set<string>(RESPONDER_CAPABILITIES.map((option) => option.code));
  const capabilityOptions = [...RESPONDER_CAPABILITIES, ...draft.capabilityCodes.filter((code) => !knownCodes.has(code)).map((code) => ({ code, label: responderCapabilityLabel(code) }))];
  return <div className="fixed inset-0 z-[var(--layer-modal)] grid place-items-center bg-black/65 p-3 sm:p-6" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="responder-modal-title" onKeyDown={onDialogKeyDown} className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl">
      <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-5 py-4"><div><h2 id="responder-modal-title" className="text-lg font-semibold">{organization ? "Manage organization" : "Add organization"}</h2><p className="text-xs text-[var(--color-muted-foreground)]">Admin-recorded information for simulated coordination.</p></div><button type="button" onClick={close} aria-label="Close organization form" className="rounded-lg p-2 hover:bg-[var(--color-panel)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]"><X className="size-5" /></button></div>
      <form onSubmit={(event) => void save(event)} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
          <fieldset disabled={loading || busy} className="space-y-6">
          {loading && <p role="status" className="text-sm">Loading organization…</p>}
          {error && <div role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] p-3 text-sm text-[var(--color-danger-text)]"><p>{error}</p>{loadFailed && <button type="button" onClick={() => { setLoading(true); setLoadFailed(false); setError(""); setLoadKey((key) => key + 1); }} className="mt-1 font-semibold underline">Retry loading</button>}</div>}
          <section className="space-y-3"><h3 className="text-sm font-semibold">Basic information</h3><div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Organization name<input value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={160} aria-invalid={Boolean(fieldErrors.name)} className={field} />{fieldErrors.name && <span className="text-xs text-[var(--color-danger)]">{fieldErrors.name}</span>}</label>
            <label className="text-sm font-medium">Organization type<select value={draft.type} onChange={(event) => set("type", event.target.value)} className={field}>{typeOptions.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
            <LocalityPicker id="responder-home" label="Home municipality" selected={draft.homeLocalityCode} onSelect={(code) => { setDraft((current) => ({ ...current, homeLocalityCode: code, coverageLocalityCodes: [...new Set([...current.coverageLocalityCodes.filter((value) => value !== current.homeLocalityCode), code])] })); setFieldErrors((current) => ({ ...current, homeLocalityCode: "" })); }} error={fieldErrors.homeLocalityCode} />
            <fieldset className="sm:col-span-2"><legend className="text-sm font-medium">Rescue capabilities</legend><div className="mt-2 flex flex-wrap gap-2">{capabilityOptions.map((option) => <label key={option.code} className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium ${draft.capabilityCodes.includes(option.code) ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "border-[var(--color-border)]"}`}><input type="checkbox" className="sr-only" checked={draft.capabilityCodes.includes(option.code)} onChange={(event) => set("capabilityCodes", event.target.checked ? [...draft.capabilityCodes, option.code] : draft.capabilityCodes.filter((code) => code !== option.code))} />{option.label}</label>)}</div></fieldset>
          </div></section>
          <section className="space-y-3 border-t border-[var(--color-border)] pt-5"><h3 className="text-sm font-semibold">Operational information</h3>
            <LocalityPicker id="responder-coverage" label="Add coverage municipality" excluded={draft.coverageLocalityCodes} onSelect={(code) => set("coverageLocalityCodes", [...new Set([...draft.coverageLocalityCodes, code])])} />
            <div className="flex flex-wrap gap-2">{draft.coverageLocalityCodes.map((code) => <span key={code} className="inline-flex items-center gap-1 rounded-full bg-[var(--color-panel)] px-2.5 py-1 text-xs">{localityName(code)}{code !== draft.homeLocalityCode && <button type="button" onClick={() => set("coverageLocalityCodes", draft.coverageLocalityCodes.filter((value) => value !== code))} aria-label={`Remove ${localityName(code)} coverage`} className="rounded-full p-0.5 hover:bg-[var(--color-muted-surface)]"><X className="size-3" /></button>}</span>)}</div>
            <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Recorded availability<select value={draft.availability} onChange={(event) => set("availability", event.target.value)} className={field}>{["unknown", "available", "busy", "unavailable"].map((value) => <option key={value} value={value}>{availabilityLabel(value)}</option>)}</select></label><label className="text-sm font-medium">Preferred communication<select value={draft.preferredChannel} onChange={(event) => set("preferredChannel", event.target.value)} className={field}><option value="">Not recorded</option><option value="phone">Phone</option><option value="sms_logged">Logged SMS</option><option value="radio">Radio</option><option value="other">Other</option></select></label></div>
            <p className="text-xs text-[var(--color-muted-foreground)]">Availability is recorded by an admin and is not a live readiness signal.</p>
          </section>
          <section className="space-y-3 border-t border-[var(--color-border)] pt-5"><h3 className="text-sm font-semibold">Contact information</h3><div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-medium">Contact office<input value={draft.contactOffice} onChange={(event) => set("contactOffice", event.target.value)} maxLength={160} className={field} /></label>
            <label className="text-sm font-medium">Contact person<input value={draft.contactPerson} onChange={(event) => set("contactPerson", event.target.value)} maxLength={160} className={field} /></label>
            <label className="text-sm font-medium">Official contact number<input value={draft.officialPhone} onChange={(event) => set("officialPhone", event.target.value)} maxLength={80} aria-invalid={Boolean(fieldErrors.officialPhone)} className={field} />{fieldErrors.officialPhone && <span className="text-xs text-[var(--color-danger)]">{fieldErrors.officialPhone}</span>}</label>
            <label className="text-sm font-medium">Secondary contact<input value={draft.secondaryContact} onChange={(event) => set("secondaryContact", event.target.value)} maxLength={160} className={field} /></label>
          </div></section>
          <section className="space-y-3 border-t border-[var(--color-border)] pt-5"><h3 className="text-sm font-semibold">Simulation settings</h3>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.demo} onChange={(event) => set("demo", event.target.checked)} />Demo organization</label>
            {organization && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />Active directory entry</label>}
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={draft.contactVerified} onChange={(event) => set("contactVerified", event.target.checked)} />I verified the recorded contact information now</label>
            {fieldErrors.contactVerified && <p className="text-xs text-[var(--color-danger)]">{fieldErrors.contactVerified}</p>}
            {organization && <p className="text-xs text-[var(--color-muted-foreground)]">Last verified: {organization.lastContactVerifiedAt ? new Date(organization.lastContactVerifiedAt).toLocaleString("en-PH") : "never"}</p>}
          </section>
          </fieldset>
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-5 py-4"><button type="button" onClick={close} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">Cancel</button><button type="submit" disabled={busy || loading || loadFailed} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : organization ? "Save changes" : "Add organization"}</button></div>
      </form>
    </div>
  </div>;
}

export function AdminResponders() {
  const [rows, setRows] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [locality, setLocality] = useState("");
  const [capability, setCapability] = useState("");
  const [availability, setAvailability] = useState("");
  const [modal, setModal] = useState<Organization | "new" | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const hasFilters = Boolean(search || locality || capability || availability);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (locality) params.set("locality", locality);
      if (capability) params.set("capability", capability);
      if (availability) params.set("availability", availability);
      setLoading(true); setError("");
      void fetch(`/api/admin/responders?${params}`, { cache: "no-store", signal: controller.signal }).then(async (response) => {
        const body = await response.json() as { data?: { organizations: Organization[] }; error?: string };
        if (!response.ok || !body.data) throw new Error(body.error || "Could not load the responder directory.");
        setRows(body.data.organizations);
      }).catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load the responder directory."); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 200);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [search, locality, capability, availability, reloadKey]);

  function saved(row: Organization) { setModal(null); setNotice(`${row.name} saved.`); retry(); }
  function clearFilters() { setSearch(""); setLocality(""); setCapability(""); setAvailability(""); }
  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-2xl font-semibold">Responder Directory</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Manage responder organizations for simulated rescue coordination across Bulacan.</p></div><button type="button" onClick={() => setModal("new")} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><Plus className="size-4" />Add Organization</button></header>
    {notice && <p role="status" className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-surface)] px-4 py-3 text-sm text-[var(--color-success-text)]">{notice}</p>}
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]"><label className="relative min-w-0 text-sm">Search organizations<Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-[var(--color-muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} placeholder="Search by name" className={`${field} pl-9`} /></label><label className="min-w-0 text-sm">Municipality<select value={locality} onChange={(event) => setLocality(event.target.value)} className={field}><option value="">All municipalities</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label><label className="min-w-0 text-sm">Capability<select value={capability} onChange={(event) => setCapability(event.target.value)} className={field}><option value="">All capabilities</option>{RESPONDER_CAPABILITIES.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label className="min-w-0 text-sm">Availability<select value={availability} onChange={(event) => setAvailability(event.target.value)} className={field}><option value="">All statuses</option>{["available", "busy", "unavailable", "unknown"].map((value) => <option key={value} value={value}>{availabilityLabel(value)}</option>)}</select></label></div>
    {error ? <div role="alert" className="rounded-xl border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] p-5 text-sm text-[var(--color-danger-text)]"><p>{error}</p><button type="button" onClick={retry} className="mt-2 font-semibold underline">Retry loading</button></div> : loading ? <p role="status" className="rounded-xl border border-[var(--color-border)] p-8 text-sm text-[var(--color-muted-foreground)]">Loading responder organizations…</p> : rows.length ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <article key={row.id} className="flex min-w-0 flex-col rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 transition-colors hover:border-[var(--color-primary)] focus-within:border-[var(--color-primary)]"><div className="flex items-start justify-between gap-3"><h3 className="min-w-0 break-words font-semibold">{row.name}</h3>{row.demo && <span className="shrink-0 rounded-full bg-[var(--color-muted-surface)] px-2 py-0.5 text-[0.7rem] font-medium text-[var(--color-muted-text)]">Demo</span>}</div><p className="mt-2 flex items-center gap-1.5 text-sm text-[var(--color-muted-foreground)]"><MapPin className="size-3.5 shrink-0" />{localityName(row.homeLocalityCode)}, Bulacan</p><div className="mt-3 flex flex-wrap gap-1.5">{row.capabilityCodes.length ? row.capabilityCodes.map((code) => <span key={code} className="rounded-full bg-[var(--color-panel)] px-2 py-1 text-xs">{responderCapabilityLabel(code)}</span>) : <span className="text-xs text-[var(--color-muted-foreground)]">Capabilities not recorded</span>}</div><div className="mt-auto flex items-end justify-between gap-2 border-t border-[var(--color-border)] pt-4"><div className="text-xs"><p>Recorded availability: <span className="font-medium">{availabilityLabel(row.availability)}</span></p><p className="mt-1 text-[var(--color-muted-foreground)]">{row.active ? "Active" : "Inactive"}{row.availability === "available" ? " · Admin recorded, not live" : ""}</p></div><button type="button" onClick={() => setModal(row)} className="shrink-0 rounded-lg border border-[var(--color-border)] px-3 py-1.5 text-xs font-semibold hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-[var(--color-primary)]">Manage</button></div></article>)}</div>{rows.length === 100 && <p className="text-xs text-[var(--color-muted-foreground)]">Showing the first 100 matches. Narrow the filters to find more.</p>}</> : <div className="rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-14 text-center"><p className="font-semibold">{hasFilters ? "No organizations match these filters." : "No responder organizations yet."}</p><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{hasFilters ? "Try a different search or clear the filters." : "Add a simulated organization to begin the directory."}</p><button type="button" onClick={hasFilters ? clearFilters : () => setModal("new")} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">{hasFilters ? "Clear Filters" : "Add Organization"}</button></div>}
    {modal && <OrganizationModal key={modal === "new" ? "new" : modal.id} organization={modal === "new" ? null : modal} onClose={() => setModal(null)} onSaved={saved} />}
  </div>;
}
