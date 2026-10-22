"use client";

import { FormEvent, useState } from "react";
import { Plus, X } from "lucide-react";

export function AdminCreateReportModal({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", category: "Flooding", severity: "Moderate", locationName: "", latitude: "14.916", longitude: "120.765" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/reports", { method: "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify({ ...form, latitude: Number(form.latitude), longitude: Number(form.longitude) }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setOpen(false);
      onCreated();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to create report.");
    } finally {
      setBusy(false);
    }
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New report</button>
    {open ? <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} className="w-full max-w-xl rounded-lg bg-[var(--color-surface)] p-5">
        <div className="flex justify-between"><h2 className="text-lg font-semibold">Create flood report</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
        {error ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
        <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">Your registered full name will be shown publicly as the reporter. <a href="/profile" className="text-[var(--color-primary)] underline">Update profile</a></p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([ ["title", "Title"], ["locationName", "Location"], ["latitude", "Latitude"], ["longitude", "Longitude"] ] as const).map(([key, label]) =>
            <label key={key} className="text-sm">{label}<input required value={form[key]} onChange={(event) => setForm({ ...form, [key]: event.target.value })} className="mt-1 w-full rounded border px-3 py-2" /></label>)}
          <label className="text-sm">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option>Flooding</option><option>Road blocked</option><option>Infrastructure damage</option><option>Other</option></select></label>
          <label className="text-sm">Severity<select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value })} className="mt-1 w-full rounded border px-3 py-2"><option>Low</option><option>Moderate</option><option>High</option><option>Critical</option></select></label>
        </div>
        <label className="mt-3 block text-sm">Description<textarea required rows={4} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} className="mt-1 w-full rounded border p-3" /></label>
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setOpen(false)} className="rounded border px-3 py-2">Cancel</button><button disabled={busy} className="rounded bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white">{busy ? "Creating..." : "Create report"}</button></div>
      </form>
    </div> : null}
  </>;
}
