"use client";

import { useRef, useState, type FormEvent } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RESCUE_ASSISTANCE_TAGS } from "@/lib/rescue-request-data";
import { emptyAdminRescueFields, serializeAdminRescueIntake, type AdminRescueFields } from "@/lib/admin-rescue-intake-form";

export type CreatedRescue = { id: string; reference: string; status: string; priority: string; locationName: string; localityCode: string; barangay: string; createdAt: string };

const inputClass = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 text-sm text-[var(--color-foreground)]";

export function AdminRescueIntakeForm({ onCreated, onDirtyChange, onCancel }: { onCreated: (request: CreatedRescue, nearDuplicate: boolean) => void; onDirtyChange?: (dirty: boolean) => void; onCancel?: () => void }) {
  const [fields, setFields] = useState<AdminRescueFields>(emptyAdminRescueFields);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const retry = useRef<{ body: string; key: string } | null>(null);
  const busyRef = useRef(false);
  function change<K extends keyof AdminRescueFields>(key: K, value: AdminRescueFields[K]) {
    setFields((current) => ({ ...current, [key]: value }));
    setError("");
    onDirtyChange?.(true);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current) return;
    let body: string;
    try { body = JSON.stringify(serializeAdminRescueIntake(fields)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Check the request details."); return; }
    if (retry.current?.body !== body) retry.current = { body, key: crypto.randomUUID() };
    busyRef.current = true; setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/rescue-requests", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": retry.current.key }, body });
      const result = await response.json().catch(() => null) as { data?: { request: CreatedRescue; nearDuplicate: boolean }; error?: string } | null;
      if (!response.ok || !result?.data?.request) throw new Error(result?.error || "Could not save the request. Try again.");
      retry.current = null;
      onDirtyChange?.(false);
      onCreated(result.data.request, result.data.nearDuplicate);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save the request. Try again."); }
    finally { busyRef.current = false; setBusy(false); }
  }
  return <form onSubmit={submit} className="space-y-5" data-testid="admin-rescue-intake-form">
    <p className="text-sm text-[var(--color-muted-foreground)]">This records a request, not a confirmed dispatch. The creator is your admin account; no resident account is created.</p>
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm text-[var(--color-danger)]">{error}</p>}
    <fieldset className="space-y-2"><legend className="font-semibold">How was this request received?</legend><div className="flex flex-wrap gap-4 text-sm">{([ ["phone", "Phone"], ["walk_in", "Walk-in"], ["other", "Other"] ] as const).map(([value, label]) => <label key={value} className="flex items-center gap-2"><input type="radio" name="intakeMethod" checked={fields.intakeMethod === value} onChange={() => change("intakeMethod", value)} />{label}</label>)}</div></fieldset>
    <fieldset className="space-y-2"><legend className="font-semibold">Who needs help?</legend><div className="flex flex-wrap gap-4 text-sm"><label><input type="radio" name="forWhom" checked={fields.forWhom === "self"} onChange={() => change("forWhom", "self")} /> The caller</label><label><input type="radio" name="forWhom" checked={fields.forWhom === "other"} onChange={() => change("forWhom", "other")} /> Someone else</label></div></fieldset>
    {fields.forWhom === "other" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Person needing help (if known)<input className={inputClass} maxLength={120} value={fields.assistedPersonName} onChange={(event) => change("assistedPersonName", event.target.value)} /></label><label className="text-sm">Caller&apos;s relationship to that person<input className={inputClass} required maxLength={80} value={fields.relationship} onChange={(event) => change("relationship", event.target.value)} /></label></div>}
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Callback number<input className={inputClass} required maxLength={120} value={fields.primaryContact} onChange={(event) => change("primaryContact", event.target.value)} /></label><label className="text-sm">Alternate contact (optional)<input className={inputClass} maxLength={120} value={fields.alternateContact} onChange={(event) => change("alternateContact", event.target.value)} /></label></div>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">People needing help<input className={inputClass} required type="number" min={1} max={1000} value={fields.peopleCount} onChange={(event) => change("peopleCount", event.target.value)} /></label><label className="text-sm">Initial priority<select className={inputClass} value={fields.priority} onChange={(event) => change("priority", event.target.value as AdminRescueFields["priority"])}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="critical">Critical</option></select></label></div>
    <fieldset><legend className="text-sm font-semibold">Special assistance needs</legend><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">{RESCUE_ASSISTANCE_TAGS.filter((tag) => tag.id !== "none").map((tag) => <label key={tag.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={fields.vulnerabilityTags.includes(tag.id)} onChange={(event) => change("vulnerabilityTags", event.target.checked ? [...fields.vulnerabilityTags, tag.id] : fields.vulnerabilityTags.filter((item) => item !== tag.id))} />{tag.label}</label>)}</div></fieldset>
    <label className="block text-sm">Other needs (optional)<textarea className={inputClass} rows={2} maxLength={1000} value={fields.vulnerabilityNotes} onChange={(event) => change("vulnerabilityNotes", event.target.value)} /></label>
    <label className="block text-sm">Situation<textarea className={inputClass} required rows={3} maxLength={3000} value={fields.description} onChange={(event) => change("description", event.target.value)} /></label>
    <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">City or municipality<select className={inputClass} required value={fields.localityCode} onChange={(event) => change("localityCode", event.target.value)}><option value="">Select Bulacan locality</option>{BULACAN_LOCALITIES.map((place) => <option key={place.code} value={place.code}>{place.name}</option>)}</select></label><label className="text-sm">Barangay<input className={inputClass} required maxLength={120} value={fields.barangay} onChange={(event) => change("barangay", event.target.value)} /></label></div>
    <label className="block text-sm">Place description<input className={inputClass} required maxLength={240} value={fields.locationName} onChange={(event) => change("locationName", event.target.value)} /></label>
    <div><p className="text-sm font-semibold">Exact point (optional)</p><p className="text-xs text-[var(--color-muted-foreground)]">Enter both coordinates if confirmed. Otherwise the location remains a manual description.</p><div className="mt-2 grid gap-3 sm:grid-cols-2"><label className="text-sm">Latitude<input className={inputClass} type="number" step="any" value={fields.latitude} onChange={(event) => change("latitude", event.target.value)} /></label><label className="text-sm">Longitude<input className={inputClass} type="number" step="any" value={fields.longitude} onChange={(event) => change("longitude", event.target.value)} /></label></div></div>
    <div><label className="block text-sm">Linked flood report ID (optional)<input className={inputClass} maxLength={100} value={fields.linkedReportId} onChange={(event) => change("linkedReportId", event.target.value)} /></label>{fields.linkedReportId.trim() && <><a className="mt-2 inline-block text-sm underline" href={`/admin/reports/${encodeURIComponent(fields.linkedReportId.trim())}`} target="_blank" rel="noopener noreferrer">Review this report in a new tab</a><label className="mt-2 flex items-start gap-2 text-sm"><input type="checkbox" checked={fields.linkConsentConfirmed} onChange={(event) => change("linkConsentConfirmed", event.target.checked)} />I reviewed the report and confirmed resident consent to link it.</label></>}</div>
    <div className="flex flex-wrap justify-end gap-3 border-t border-[var(--color-border)] pt-4">{onCancel && <button type="button" disabled={busy} onClick={onCancel} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">Cancel</button>}<button type="submit" disabled={busy} className="rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" data-testid="admin-rescue-submit">{busy ? "Saving…" : "Record rescue request"}</button></div>
  </form>;
}
