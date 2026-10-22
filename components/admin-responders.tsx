"use client";

import { useCallback, useEffect, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";

type Organization = {
  id: string; name: string; type: string; homeLocalityCode: string; coverageLocalityCodes: string[];
  capabilityCodes: string[]; contactOffice: string | null; contactPerson: string | null;
  officialPhone: string | null; secondaryContact: string | null; preferredChannel: string | null;
  availability: string; active: boolean; lastContactVerifiedAt: string | null; demo: boolean;
};
type Draft = { name: string; type: string; homeLocalityCode: string; coverageLocalityCodes: string[]; capabilityCodes: string; contactOffice: string; contactPerson: string; officialPhone: string; secondaryContact: string; preferredChannel: string; availability: string; active: boolean; demo: boolean; contactVerified: boolean };
const empty: Draft = { name: "", type: "municipal_office", homeLocalityCode: "", coverageLocalityCodes: [], capabilityCodes: "", contactOffice: "", contactPerson: "", officialPhone: "", secondaryContact: "", preferredChannel: "", availability: "unknown", active: true, demo: true, contactVerified: false };
const field = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm";
const localityName = (code: string) => BULACAN_LOCALITIES.find((place) => place.code === code)?.name ?? code;
const draftFrom = (row: Organization): Draft => ({ ...row, capabilityCodes: row.capabilityCodes.join(", "), contactOffice: row.contactOffice ?? "", contactPerson: row.contactPerson ?? "", officialPhone: row.officialPhone ?? "", secondaryContact: row.secondaryContact ?? "", preferredChannel: row.preferredChannel ?? "", contactVerified: false });

export function AdminResponders() {
  const [rows, setRows] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [locality, setLocality] = useState("");
  const [availability, setAvailability] = useState("");
  const [capability, setCapability] = useState("");
  const [selected, setSelected] = useState<Organization | null>(null);
  const [draft, setDraft] = useState<Draft>(empty);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (locality) params.set("locality", locality);
      if (capability.trim()) params.set("capability", capability.trim().toLowerCase());
      if (availability) params.set("availability", availability);
      const response = await fetch(`/api/admin/responders?${params}`, { cache: "no-store" });
      const body = await response.json() as { data?: { organizations: Organization[] }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not load responder directory.");
      setRows(body.data.organizations);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load responder directory."); }
    finally { setLoading(false); }
  }, [search, locality, capability, availability]);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 250); return () => window.clearTimeout(timer); }, [load]);

  function choose(row: Organization | null) { setSelected(row); setDraft(row ? draftFrom(row) : empty); setError(""); setNotice(""); }
  function set<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((current) => ({ ...current, [key]: value })); }
  async function save() {
    if (busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const payload = {
        name: draft.name, type: draft.type, homeLocalityCode: draft.homeLocalityCode,
        coverageLocalityCodes: [...new Set([...draft.coverageLocalityCodes, draft.homeLocalityCode].filter(Boolean))],
        capabilityCodes: draft.capabilityCodes.split(",").map((part) => part.trim().toLowerCase()).filter(Boolean),
        contactOffice: draft.contactOffice || null, contactPerson: draft.contactPerson || null,
        officialPhone: draft.officialPhone || null, secondaryContact: draft.secondaryContact || null,
        preferredChannel: draft.preferredChannel || null, demo: draft.demo,
        ...(selected ? { active: draft.active, availability: draft.availability, contactVerified: draft.contactVerified } : {}),
      };
      const response = await fetch(selected ? `/api/admin/responders/${encodeURIComponent(selected.id)}` : "/api/admin/responders", {
        method: selected ? "PATCH" : "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify(payload),
      });
      const body = await response.json() as { data?: Organization; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not save organization.");
      setSelected(body.data); setDraft(draftFrom(body.data)); setNotice("Organization saved. Directory entries do not indicate live responder availability.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save organization."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-5">
    <header><h2 className="text-2xl font-semibold">Responder directory</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Admin-maintained coordination records for this simulation. The app never contacts an organization.</p></header>
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-[var(--color-success-border)] p-3 text-sm">{notice}</p>}
    <div className="grid gap-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">Search<input value={search} onChange={(event) => setSearch(event.target.value)} maxLength={100} className={field} placeholder="Organization name" /></label>
      <label className="text-sm">Coverage<select value={locality} onChange={(event) => setLocality(event.target.value)} className={field}><option value="">All Bulacan</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label>
      <label className="text-sm">Capability code<input value={capability} onChange={(event) => setCapability(event.target.value)} className={field} placeholder="boat" /></label>
      <label className="text-sm">Recorded availability<select value={availability} onChange={(event) => setAvailability(event.target.value)} className={field}><option value="">Any</option>{["available", "busy", "unavailable", "unknown"].map((value) => <option key={value}>{value}</option>)}</select></label>
    </div>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="flex items-center justify-between gap-3"><h3 className="font-semibold">Organizations</h3><button onClick={() => choose(null)} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white">New organization</button></div>
        {loading ? <p role="status" className="mt-4 text-sm">Loading directory…</p> : rows.length ? <ul className="mt-4 space-y-2">{rows.map((row) => <li key={row.id}><button onClick={() => choose(row)} className={`w-full rounded-lg border p-3 text-left text-sm ${selected?.id === row.id ? "border-[var(--color-primary)]" : "border-[var(--color-border)]"}`}><span className="font-semibold">{row.name}</span><span className="mt-1 block text-[var(--color-muted-foreground)]">{localityName(row.homeLocalityCode)} · {row.availability} · {row.active ? "active" : "inactive"}{row.demo ? " · demo" : ""}</span></button></li>)}</ul> : <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">No organizations match these filters.</p>}
        {rows.length === 100 && <p className="mt-3 text-xs">Showing the first 100 matches. Narrow the filters to find more.</p>}
      </section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><h3 className="font-semibold">{selected ? "Edit organization" : "Add organization"}</h3>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">Name<input value={draft.name} onChange={(event) => set("name", event.target.value)} maxLength={160} className={field} /></label>
          <label className="text-sm">Type<input value={draft.type} onChange={(event) => set("type", event.target.value)} maxLength={40} className={field} /></label>
          <label className="text-sm">Home locality<select value={draft.homeLocalityCode} onChange={(event) => set("homeLocalityCode", event.target.value)} className={field}><option value="">Choose locality</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label>
          <label className="text-sm">Capability codes (comma separated)<input value={draft.capabilityCodes} onChange={(event) => set("capabilityCodes", event.target.value)} className={field} placeholder="boat, medical" /></label>
          <fieldset className="sm:col-span-2"><legend className="text-sm">Coverage (home locality is included)</legend><div className="mt-2 grid max-h-40 grid-cols-2 gap-2 overflow-y-auto rounded-lg border border-[var(--color-border)] p-3 text-xs sm:grid-cols-3">{BULACAN_LOCALITIES.map((place) => <label key={place.code} className="flex items-start gap-1.5"><input type="checkbox" checked={draft.coverageLocalityCodes.includes(place.code) || draft.homeLocalityCode === place.code} disabled={draft.homeLocalityCode === place.code} onChange={(event) => set("coverageLocalityCodes", event.target.checked ? [...draft.coverageLocalityCodes, place.code] : draft.coverageLocalityCodes.filter((code) => code !== place.code))} />{place.name}</label>)}</div></fieldset>
          <label className="text-sm">Contact office<input value={draft.contactOffice} onChange={(event) => set("contactOffice", event.target.value)} maxLength={160} className={field} /></label>
          <label className="text-sm">Contact person<input value={draft.contactPerson} onChange={(event) => set("contactPerson", event.target.value)} maxLength={160} className={field} /></label>
          <label className="text-sm">Official phone<input value={draft.officialPhone} onChange={(event) => set("officialPhone", event.target.value)} maxLength={80} className={field} /></label>
          <label className="text-sm">Secondary/radio contact<input value={draft.secondaryContact} onChange={(event) => set("secondaryContact", event.target.value)} maxLength={160} className={field} /></label>
          <label className="text-sm">Preferred channel<select value={draft.preferredChannel} onChange={(event) => set("preferredChannel", event.target.value)} className={field}><option value="">Not recorded</option>{["phone", "sms_logged", "radio", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          {selected && <label className="text-sm">Recorded availability<select value={draft.availability} onChange={(event) => set("availability", event.target.value)} className={field}>{["unknown", "available", "busy", "unavailable"].map((value) => <option key={value}>{value}</option>)}</select></label>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.demo} onChange={(event) => set("demo", event.target.checked)} />Demo organization</label>
          {selected && <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.active} onChange={(event) => set("active", event.target.checked)} />Active directory entry</label>}
          {selected && <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" checked={draft.contactVerified} onChange={(event) => set("contactVerified", event.target.checked)} />I verified the recorded contact information now</label>}
        </div>
        {selected && <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">Last contact verified: {selected.lastContactVerifiedAt ? new Date(selected.lastContactVerifiedAt).toLocaleString("en-PH") : "never"}</p>}
        <button disabled={busy || !draft.name.trim() || !draft.homeLocalityCode} onClick={() => void save()} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Saving…" : selected ? "Save changes" : "Add organization"}</button>
      </section>
    </div>
  </div>;
}
