"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { RESCUE_TRANSITIONS, TERMINAL_RESCUE_STATUSES, type RescueStatus } from "@/lib/rescue-contracts";

type Event = { id: string; eventType: string; previousStatus: string | null; nextStatus: string | null; previousPriority: string | null; nextPriority: string | null; createdAt: string; visibility: string; reason: string | null; note: string | null; actorUserId: string };
type Detail = {
  id: string; reference: string; version: number; status: RescueStatus; priority: string;
  createdAt: string; updatedAt: string; requesterUserId: string | null; intakeChannel: string;
  assistedIntakeMethod: string | null; forWhom: string; assistedPersonName: string | null;
  relationship: string | null; primaryContact: string; alternateContact: string | null;
  peopleCount: number; vulnerabilityTags: string[]; vulnerabilityNotes: string | null;
  description: string; locationName: string; localityCode: string; barangay: string;
  locationUncertainty: string; latitude: number | null; longitude: number | null;
  caseOwnerUserId: string | null; confirmedTeamReference: string | null; outcome: string | null;
  events: Event[];
};
type Operator = { id: string; displayName: string | null; email: string };
type Envelope<T> = { data?: T; error?: string };

export function AdminRescueDetail({ id }: { id: string }) {
  const [request, setRequest] = useState<Detail | null>(null);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [stale, setStale] = useState(false);
  const [needsReview, setNeedsReview] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [priority, setPriority] = useState("routine");
  const [caseOwnerUserId, setCaseOwnerUserId] = useState("");
  const [nextStatus, setNextStatus] = useState("");
  const [reason, setReason] = useState("");
  const [teamReference, setTeamReference] = useState("");
  const [dispatchConfirmed, setDispatchConfirmed] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState("internal");
  const draftVersion = useRef<number | null>(null);

  const refresh = useCallback(async (resetDraft = false) => {
    try {
      const response = await fetch(`/api/admin/rescue-requests/${encodeURIComponent(id)}`, { cache: "no-store" });
      const body = await response.json().catch(() => null) as Envelope<Detail> | null;
      if (!response.ok || !body?.data) throw new Error(body?.error || "Could not load this rescue request.");
      const changedInBackground = !resetDraft && draftVersion.current !== null && draftVersion.current !== body.data.version;
      setRequest(body.data);
      setNeedsReview(changedInBackground);
      if (resetDraft) {
        draftVersion.current = body.data.version;
        setPriority(body.data.priority);
        setCaseOwnerUserId(body.data.caseOwnerUserId ?? "");
      }
      setLastChecked(new Date());
      setStale(false);
      setError(changedInBackground ? "Another administrator updated this request. Review the latest version before acting." : "");
    } catch (cause) { setStale(true); setError(cause instanceof Error ? cause.message : "Could not refresh this request."); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { const timer = window.setTimeout(() => void refresh(true), 0); return () => window.clearTimeout(timer); }, [refresh]);
  useEffect(() => {
    void fetch("/api/admin/rescue-operators", { cache: "no-store" }).then(async (response) => {
      const body = await response.json() as Envelope<{ operators: Operator[] }>;
      if (response.ok && body.data) setOperators(body.data.operators);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const onResume = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); };
    const timer = window.setInterval(onResume, 30_000);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onResume); window.removeEventListener("online", onResume); };
  }, [refresh]);

  async function act(action: Record<string, unknown>) {
    if (!request || busy || (draftVersion.current !== null && draftVersion.current !== request.version)) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/admin/rescue-requests/${encodeURIComponent(id)}/actions`, {
        method: "POST", headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify({ expectedVersion: draftVersion.current ?? request.version, ...action }),
      });
      const body = await response.json().catch(() => null) as Envelope<Detail> | null;
      if (!response.ok) {
        if (response.status === 409) {
          await refresh(true);
          throw new Error("Another administrator updated this request. The latest version is shown; review before retrying.");
        }
        throw new Error(body?.error || "Could not save this action.");
      }
      setReason(""); setTeamReference(""); setDispatchConfirmed(false); setOutcome(""); setNote(""); setNextStatus("");
      await refresh(true);
      setNotice("Action saved. Public updates are visible to the requester; internal notes remain private.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this action."); }
    finally { setBusy(false); }
  }

  if (loading && !request) return <p role="status">Loading rescue request…</p>;
  if (!request) return <div role="alert">{error || "Rescue request unavailable."} <Link href="/admin/rescue-requests" className="underline">Back to queue</Link></div>;
  const terminal = TERMINAL_RESCUE_STATUSES.includes(request.status);
  const allowed = RESCUE_TRANSITIONS[request.status] ?? [];
  const triagedAt = request.events.find((event) => event.nextStatus === "triaged")?.createdAt;
  const dispatchAt = request.events.find((event) => event.nextStatus === "en_route")?.createdAt;
  const reasonRequired = nextStatus === "rejected" || nextStatus === "cancelled" || (nextStatus === "triaged" && request.status !== "received") || nextStatus === "en_route";
  const transitionReady = nextStatus && (!reasonRequired || reason.trim()) && (nextStatus !== "en_route" || (teamReference.trim() && dispatchConfirmed)) && (nextStatus !== "completed" || outcome.trim());
  const field = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-sm";

  return <div className="space-y-6">
    <Link href="/admin/rescue-requests" className="text-sm underline">← Back to rescue queue</Link>
    <header><h2 className="mt-2 font-mono text-2xl font-bold">{request.reference}</h2><p className="mt-1 text-sm">{request.status.replaceAll("_", " ")} · {request.priority} priority · Version {request.version}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Last checked {lastChecked?.toLocaleString("en-PH") ?? "not yet"}</p></header>
    {stale && <p role="status" className="rounded-lg border border-[var(--color-warning-border)] p-3 text-sm">Showing last loaded information. <button onClick={() => void refresh()} className="underline">Retry refresh</button></p>}
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error} {needsReview && <button onClick={() => void refresh(true)} className="underline">Review latest version</button>}</p>}
    {notice && <p role="status" className="rounded-lg border border-[var(--color-success-border)] p-3 text-sm">{notice}</p>}
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-lg font-semibold">Request details</h3>
        <p><strong>Received:</strong> {new Date(request.createdAt).toLocaleString("en-PH")} ({request.intakeChannel.replaceAll("_", " ")}{request.assistedIntakeMethod ? ` · ${request.assistedIntakeMethod.replaceAll("_", " ")}` : ""})</p>
        <p><strong>First triage:</strong> {triagedAt ? new Date(triagedAt).toLocaleString("en-PH") : "Not yet"}</p><p><strong>Dispatch acknowledged:</strong> {dispatchAt ? new Date(dispatchAt).toLocaleString("en-PH") : "Not confirmed"}</p>
        <p><strong>Case owner:</strong> {operators.find((operator) => operator.id === request.caseOwnerUserId)?.displayName ?? operators.find((operator) => operator.id === request.caseOwnerUserId)?.email ?? request.caseOwnerUserId ?? "Unassigned"}</p>
        <p><strong>Confirmed responder/team:</strong> {request.confirmedTeamReference ?? "Not confirmed"}</p>
        <p><strong>People:</strong> {request.peopleCount} · <strong>For:</strong> {request.forWhom}{request.assistedPersonName ? ` (${request.assistedPersonName})` : ""}</p>
        <p><strong>Contact:</strong> {request.primaryContact}{request.alternateContact ? ` · Alternate: ${request.alternateContact}` : ""}</p>
        <p><strong>Location:</strong> {request.locationName}, {request.barangay}, {BULACAN_LOCALITIES.find((place) => place.code === request.localityCode)?.name ?? "Bulacan"} ({request.locationUncertainty})</p>
        <p><strong>Needs:</strong> {request.vulnerabilityTags.length ? request.vulnerabilityTags.join(", ") : "None selected"}{request.vulnerabilityNotes ? ` · ${request.vulnerabilityNotes}` : ""}</p>
        <p className="whitespace-pre-wrap"><strong>Description:</strong> {request.description}</p>{request.outcome && <p className="whitespace-pre-wrap"><strong>Outcome:</strong> {request.outcome}</p>}
      </section>
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-lg font-semibold">Operational actions</h3>
        {terminal ? <p>This request is closed. No further actions are allowed.</p> : <>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Priority<select disabled={busy || needsReview} value={priority} onChange={(event) => setPriority(event.target.value)} className={field}>{["routine", "urgent", "critical"].map((value) => <option key={value}>{value}</option>)}</select></label><button disabled={busy || needsReview || priority === request.priority} onClick={() => void act({ action: "priority", priority })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Update priority</button></div>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Case owner (administrator, not responder)<select disabled={busy || needsReview} value={caseOwnerUserId} onChange={(event) => setCaseOwnerUserId(event.target.value)} className={field}><option value="">Choose administrator</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.displayName ?? operator.email}</option>)}</select></label><button disabled={busy || needsReview || !caseOwnerUserId || request.status === "received" || !["triaged", "assigned"].includes(request.status) || caseOwnerUserId === request.caseOwnerUserId} onClick={() => void act({ action: "assign", caseOwnerUserId })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">{request.caseOwnerUserId ? "Reassign case owner" : "Assign case owner"}</button></div>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Change status<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className={field}><option value="">Choose next status</option>{allowed.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            {reasonRequired && <label className="block text-sm">{nextStatus === "en_route" ? "How was dispatch acknowledged? (internal)" : "Reason (internal)"}<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className={field} /></label>}
            {nextStatus === "en_route" && <><label className="block text-sm">Confirmed responder/team reference<input value={teamReference} onChange={(event) => setTeamReference(event.target.value)} maxLength={160} className={field} /></label><label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={dispatchConfirmed} onChange={(event) => setDispatchConfirmed(event.target.checked)} />I directly confirmed this team accepted the dispatch. This is not inferred from assigning a case owner.</label></>}
            {nextStatus === "completed" && <label className="block text-sm">Recorded outcome<textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} maxLength={1000} className={field} /></label>}
            <button disabled={busy || needsReview || !transitionReady} onClick={() => void act({ action: "transition", nextStatus, ...(reasonRequired ? { reason } : {}), ...(nextStatus === "en_route" ? { confirmedTeamReference: teamReference } : {}), ...(nextStatus === "completed" ? { outcome } : {}) })} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Save status</button>
          </div>
          <div className="space-y-2"><label className="block text-sm">Note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} className={field} /></label><label className="block text-sm">Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)} className={field}><option value="internal">Internal only</option><option value="public">Visible to requester</option></select></label><button disabled={busy || needsReview || !note.trim()} onClick={() => void act({ action: "note", note, visibility })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Add note</button></div>
        </>}
      </section>
    </div>
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-lg font-semibold">Event history</h3><ol className="mt-4 space-y-4">{request.events.map((event) => <li key={event.id} className="border-l-2 border-[var(--color-border)] pl-4 text-sm"><p className="font-semibold">{event.eventType.replaceAll("_", " ")}{event.previousStatus !== event.nextStatus ? ` · ${event.previousStatus ?? "start"} → ${event.nextStatus ?? "unknown"}` : ""}</p><p className="text-xs text-[var(--color-muted-foreground)]">{new Date(event.createdAt).toLocaleString("en-PH")} · {event.visibility === "internal" ? "Internal only" : "Requester-visible"}</p>{event.reason && <p className="mt-1 whitespace-pre-wrap">Reason: {event.reason}</p>}{event.note && <p className="mt-1 whitespace-pre-wrap">{event.note}</p>}</li>)}</ol></section>
  </div>;
}
