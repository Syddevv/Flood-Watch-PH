"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { RESCUE_REASSIGNABLE_STATUSES } from "@/lib/rescue-contracts";

type Organization = { id: string; name: string; coverageLocalityCodes: string[]; capabilityCodes: string[]; officialPhone: string | null; secondaryContact: string | null; preferredChannel: string | null; availability: string; active: boolean; lastContactVerifiedAt: string | null; demo: boolean };
export type CoordinationAssignment = { id: string; status: string; selectedAt: string; contactedAt: string | null; contactChannel: string | null; contactDetails: string | null; acknowledgementOutcome: string | null; acknowledgedAt: string | null; dispatchConfirmedAt: string | null; departedAt: string | null; arrivedAt: string | null; reportedCompletedAt: string | null; endedAt: string | null; endReason: string | null; organization: Organization };
const field = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm";

export function AdminRescueCoordination({ requestId, version, status, localityCode, assignments, disabled, onSaved }: { requestId: string; version: number; status: string; localityCode: string; assignments: CoordinationAssignment[]; disabled: boolean; onSaved: () => Promise<void> }) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [reason, setReason] = useState("");
  const [channel, setChannel] = useState("phone");
  const [note, setNote] = useState("");
  const [outcome, setOutcome] = useState("accepted");
  const [openedAt] = useState(() => Date.now());
  const active = assignments.find((assignment) => !assignment.endedAt);
  const selected = organizations.find((organization) => organization.id === organizationId);
  const allowed = RESCUE_REASSIGNABLE_STATUSES.includes(status);
  const recent = selected?.lastContactVerifiedAt && new Date(selected.lastContactVerifiedAt).getTime() >= openedAt - 7 * 24 * 60 * 60_000;
  const needsOverride = selected && (selected.availability !== "available" || !recent);

  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/admin/responders?locality=${encodeURIComponent(localityCode)}`, { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as { data?: { organizations: Organization[] }; error?: string };
      if (!response.ok || !body.data) throw new Error(body.error || "Could not load responder organizations.");
      if (!cancelled) setOrganizations(body.data.organizations);
    }).catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load responder organizations."); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [localityCode]);

  async function submit(action: Record<string, unknown>) {
    if (busy || disabled) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/rescue-requests/${encodeURIComponent(requestId)}/coordination`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ expectedVersion: version, ...action }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) throw new Error(response.status === 409 ? "This request changed. Refresh and review the latest coordination history before retrying." : body.error || "Could not record coordination action.");
      setReason(""); setNote(""); setOrganizationId("");
      await onSaved();
      setNotice("Manual coordination action recorded. No organization was contacted by this app.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record coordination action."); }
    finally { setBusy(false); }
  }

  return <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-semibold">Responder coordination</h3><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Simulation only. Selection and admin-recorded contact do not mean dispatch or live availability.</p></div><Link href="/admin/responders" className="text-sm underline">Manage directory</Link></div>
    {error && <p role="alert" className="mt-3 rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error}</p>}
    {notice && <p role="status" className="mt-3 rounded-lg border border-[var(--color-success-border)] p-3 text-sm">{notice}</p>}
    {assignments.length ? <ol className="mt-4 space-y-3">{assignments.map((assignment) => <li key={assignment.id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] p-3 text-sm"><p className="font-semibold">{assignment.organization.name}{assignment.organization.demo ? " · Demo" : ""} · {assignment.status.replaceAll("_", " ")}</p><p className="text-xs text-[var(--color-muted-foreground)]">Selected {new Date(assignment.selectedAt).toLocaleString("en-PH")}{assignment.contactedAt ? ` · Contact logged ${new Date(assignment.contactedAt).toLocaleString("en-PH")}` : ""}{assignment.acknowledgedAt ? ` · Outcome recorded ${new Date(assignment.acknowledgedAt).toLocaleString("en-PH")}` : ""}{assignment.dispatchConfirmedAt ? ` · Dispatch recorded ${new Date(assignment.dispatchConfirmedAt).toLocaleString("en-PH")}` : ""}{assignment.departedAt ? ` · Departure reported ${new Date(assignment.departedAt).toLocaleString("en-PH")}` : ""}{assignment.arrivedAt ? ` · Arrival reported ${new Date(assignment.arrivedAt).toLocaleString("en-PH")}` : ""}{assignment.reportedCompletedAt ? ` · Completion reported ${new Date(assignment.reportedCompletedAt).toLocaleString("en-PH")}` : ""}</p>{assignment.contactChannel && <p>Channel: {assignment.contactChannel.replaceAll("_", " ")}</p>}{assignment.contactDetails && <p className="whitespace-pre-wrap">Contact note: {assignment.contactDetails}</p>}{assignment.acknowledgementOutcome && <p>Admin-recorded outcome: {assignment.acknowledgementOutcome}</p>}{assignment.endReason && <p className="whitespace-pre-wrap">End reason: {assignment.endReason}</p>}</li>)}</ol> : <p className="mt-4 text-sm text-[var(--color-muted-foreground)]">No organization selected yet.</p>}
    {!allowed ? <p className="mt-4 text-sm">Coordination actions are available during responder selection and reassignment.</p> : <div className="mt-5 grid gap-5 lg:grid-cols-2">
      <div className="space-y-3"><h4 className="font-semibold">{active ? "Reassign organization" : "Select organization"}</h4>
        {loading ? <p role="status" className="text-sm">Loading directory…</p> : <label className="block text-sm">Organization<select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} className={field}><option value="">Choose a covered organization</option>{organizations.filter((organization) => organization.active && organization.availability !== "unavailable").map((organization) => <option key={organization.id} value={organization.id}>{organization.name}{organization.demo ? " (demo)" : ""} · {organization.availability}</option>)}</select></label>}
        {selected && <div className="rounded-lg border border-[var(--color-border)] p-3 text-sm"><p>Capabilities: {selected.capabilityCodes.join(", ") || "not recorded"}</p><p>Official phone: {selected.officialPhone || "not recorded"}</p><p>Secondary/radio: {selected.secondaryContact || "not recorded"}</p><p>Last contact verified: {selected.lastContactVerifiedAt ? new Date(selected.lastContactVerifiedAt).toLocaleString("en-PH") : "never"}</p></div>}
        <label className="block text-sm">{active ? "Reassignment reason" : needsOverride ? "Reason to use unverified availability" : "Selection reason (optional)"}<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className={field} /></label>
        <button disabled={busy || disabled || loading || !selected || (Boolean(active || needsOverride) && reason.trim().length < 10)} onClick={() => void submit({ action: active ? "reassign" : "select", organizationId, ...(reason.trim() ? { reason } : {}) })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">{active ? "Record reassignment" : "Select organization"}</button>
      </div>
      {active && <div className="space-y-3"><h4 className="font-semibold">Manual contact and acknowledgement</h4>{active.status === "selected" ? <><label className="block text-sm">Contact channel<select value={channel} onChange={(event) => setChannel(event.target.value)} className={field}>{["phone", "sms_logged", "radio", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm">Private contact note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className={field} /></label><button disabled={busy || disabled || note.trim().length < 10} onClick={() => void submit({ action: "contact", channel, note })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">Record manual attempt</button></> : active.status === "awaiting_response" ? <><label className="block text-sm">Admin-recorded outcome<select value={outcome} onChange={(event) => setOutcome(event.target.value)} className={field}>{["accepted", "declined", "unreachable", "unavailable"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="block text-sm">Private evidence or reason<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} className={field} /></label><button disabled={busy || disabled || note.trim().length < 10} onClick={() => void submit({ action: "acknowledge", outcome, note })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">Record outcome</button></> : <p className="text-sm">Acceptance and later stages are admin-recorded. Reassignment requires a reason and retains the prior history.</p>}</div>}
    </div>}
  </section>;
}
