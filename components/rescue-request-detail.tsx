"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuthSession, type AuthUser } from "@/components/auth-session-provider";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isTerminalRescue, rescueApi, rescueEventLabel, rescueStatusLabel, type RescueRecord } from "@/lib/rescue-request-client";

export function RescueRequestDetail({ id }: { id: string }) {
  const { user, isLoading: authLoading } = useAuthSession();
  return <RescueRequestDetailForSession key={`${user?.id ?? "guest"}:${id}`} id={id} user={user} authLoading={authLoading} />;
}

function RescueRequestDetailForSession({ id, user, authLoading }: { id: string; user: AuthUser; authLoading: boolean }) {
  const [record, setRecord] = useState<RescueRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [contact, setContact] = useState("");
  const [description, setDescription] = useState("");
  const [locationName, setLocationName] = useState("");
  const [localityCode, setLocalityCode] = useState("");
  const [barangay, setBarangay] = useState("");

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const next = await rescueApi<RescueRecord>(`/api/rescue-requests/${encodeURIComponent(id)}`);
      setRecord(next);
      setLastChecked(new Date());
      setError(null); setStale(false);
    } catch (cause) {
      setStale(true);
      setError(cause instanceof Error ? cause.message : "Unable to load this request.");
    }
  }, [id, user]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    if (!record || isTerminalRescue(record.status) || !user) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); }, 30_000);
    const onResume = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); };
    window.addEventListener("focus", onResume); window.addEventListener("online", onResume); document.addEventListener("visibilitychange", onResume);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onResume); window.removeEventListener("online", onResume); document.removeEventListener("visibilitychange", onResume); };
  }, [record, user, refresh]);

  async function update(body: Record<string, unknown>) {
    if (!record || saving) return;
    setSaving(true);
    try {
      const next = await rescueApi<RescueRecord>(`/api/rescue-requests/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, expectedVersion: record.version }) });
      setRecord(next); setEditing(false); setError(null); setStale(false);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update the request.");
      if (cause instanceof Error && /changed/i.test(cause.message)) void refresh();
    } finally { setSaving(false); }
  }

  if (authLoading) return <p className="p-6">Checking your account…</p>;
  if (!user) return <p className="p-6">Sign in to view your rescue request. <Link href="/login?next=/rescue-request" className="underline">Sign in</Link></p>;
  return <div className="h-full overflow-y-auto bg-[var(--color-background)]"><main className="mx-auto max-w-3xl space-y-5 p-4 pb-10 md:p-8">
    <Link href="/rescue-request" className="text-sm underline">← My Rescue Requests</Link>
    {error ? <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error} <button type="button" onClick={() => void refresh()} className="underline">Retry</button></p> : null}
    {stale && record ? <p role="status" className="rounded-lg border border-[var(--color-warning)] p-3 text-sm">Showing last known information{lastChecked ? ` from ${lastChecked.toLocaleString("en-PH")}` : ""}.</p> : null}
    {!record ? <p>{error ? "Request details are unavailable." : "Loading request…"}</p> : <>
      <header className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <p className="font-mono text-sm">{record.reference}</p><h1 className="mt-2 text-2xl font-semibold">{rescueStatusLabel(record.status)}</h1>
        <p className="mt-2 text-sm">Received {new Date(record.createdAt).toLocaleString("en-PH")}</p>
        <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">A request receipt does not confirm that a team has been dispatched.</p>
      </header>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Request details</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div><dt className="font-semibold">Location</dt><dd>{record.locationName}, {record.barangay}</dd></div>
          <div><dt className="font-semibold">Location source</dt><dd>{record.locationUncertainty === "gps" ? "GPS" : record.locationUncertainty === "map" ? "Map pin" : "Manual description; coordinates may be unknown"}</dd></div>
          <div><dt className="font-semibold">People</dt><dd>{record.peopleCount}</dd></div>
          <div><dt className="font-semibold">Contact</dt><dd>{record.primaryContact}</dd></div>
        </dl>
        <p className="mt-3 whitespace-pre-wrap text-sm">{record.description}</p>
        {record.vulnerabilityTags.length ? <p className="mt-2 text-sm">Special needs: {record.vulnerabilityTags.join(", ")}</p> : null}
      </section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Updates</h2>
        <ol className="mt-3 space-y-3">{record.events?.map((event) => <li key={event.id} className="border-l-2 border-[var(--color-primary)] pl-3 text-sm"><p className="font-semibold">{rescueEventLabel(event)}</p><p>{new Date(event.createdAt).toLocaleString("en-PH")}</p>{event.note ? <p className="mt-1">{event.note}</p> : null}</li>)}</ol>
      </section>
      {!isTerminalRescue(record.status) ? <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="text-lg font-semibold">Change this request</h2>
        {["received", "triaged"].includes(record.status) ? <>
          <button type="button" onClick={() => { setContact(record.primaryContact); setDescription(record.description); setLocationName(record.locationName); setLocalityCode(record.localityCode); setBarangay(record.barangay); setEditing(!editing); }} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Correct request details</button>
          {editing ? <form onSubmit={(event) => { event.preventDefault(); const locationChanged = locationName !== record.locationName || localityCode !== record.localityCode || barangay !== record.barangay; void update({ primaryContact: contact, description, ...(locationChanged ? { locationName, localityCode, barangay, latitude: null, longitude: null, locationUncertainty: "manual" } : {}) }); }} className="space-y-3">
            <label className="block text-sm">Contact<input value={contact} onChange={(event) => setContact(event.target.value)} required maxLength={120} className="mt-1 w-full rounded-lg border border-[var(--color-border)] p-2.5" /></label>
            <label className="block text-sm">Situation<textarea value={description} onChange={(event) => setDescription(event.target.value)} required maxLength={3000} className="mt-1 w-full rounded-lg border border-[var(--color-border)] p-2.5" /></label>
            <label className="block text-sm">Place description<input value={locationName} onChange={(event) => setLocationName(event.target.value)} required maxLength={240} className="mt-1 w-full rounded-lg border border-[var(--color-border)] p-2.5" /></label>
            <label className="block text-sm">City or municipality<select value={localityCode} onChange={(event) => setLocalityCode(event.target.value)} required className="mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5">{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label>
            <label className="block text-sm">Barangay<input value={barangay} onChange={(event) => setBarangay(event.target.value)} required maxLength={120} className="mt-1 w-full rounded-lg border border-[var(--color-border)] p-2.5" /></label>
            <p className="text-xs text-[var(--color-muted-foreground)]">Changing the place uses a manual description and clears the old pin. Contact an operator if a precise pin is needed.</p>
            <button type="submit" disabled={saving} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white">Save correction</button>
          </form> : null}
        </> : <p className="text-sm">After assignment, contact an operator to correct details.</p>}
        <div><button type="button" disabled={saving} onClick={() => { if (window.confirm(record.status === "received" || record.status === "triaged" ? "Cancel this request?" : "Ask an operator to confirm cancellation?")) void update({ action: "cancel" }); }} className="rounded-lg border border-[var(--color-danger-border)] px-3 py-2 text-sm">{["received", "triaged"].includes(record.status) ? "Cancel request" : "Request cancellation"}</button></div>
      </section> : null}
    </>}
  </main></div>;
}
