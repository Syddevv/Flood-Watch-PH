"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { EXCEPTIONAL_RESCUE_STATUSES, RESCUE_OUTCOMES, RESCUE_TRANSITIONS, TERMINAL_RESCUE_STATUSES, type RescueStatus } from "@/lib/rescue-contracts";
import { AdminRescueCoordination, type CoordinationAssignment } from "@/components/admin-rescue-coordination";

type Event = { id: string; eventType: string; previousStatus: string | null; nextStatus: string | null; previousPriority: string | null; nextPriority: string | null; createdAt: string; occurredAt: string | null; visibility: string; reason: string | null; note: string | null; actorUserId: string; details?: { triageNote?: string; outcomeCode?: string } };
type Detail = {
  id: string; reference: string; version: number; workflowVersion: number; status: RescueStatus; priority: string;
  createdAt: string; updatedAt: string; requesterUserId: string | null; intakeChannel: string;
  assistedIntakeMethod: string | null; forWhom: string; assistedPersonName: string | null;
  relationship: string | null; primaryContact: string; alternateContact: string | null;
  peopleCount: number; vulnerabilityTags: string[]; vulnerabilityNotes: string | null;
  description: string; locationName: string; localityCode: string; barangay: string;
  locationUncertainty: string; latitude: number | null; longitude: number | null;
  caseOwnerUserId: string | null; confirmedTeamReference: string | null; outcome: string | null;
  events: Event[]; assignments?: CoordinationAssignment[];
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
  const [triageNote, setTriageNote] = useState("");
  const [dispatchMethod, setDispatchMethod] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [outcomeCode, setOutcomeCode] = useState("");
  const [outcome, setOutcome] = useState("");
  const [duplicateRequestId, setDuplicateRequestId] = useState("");
  const [referralDestination, setReferralDestination] = useState("");
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
      setReason(""); setTriageNote(""); setDispatchMethod(""); setOccurredAt(""); setOutcomeCode(""); setOutcome(""); setDuplicateRequestId(""); setReferralDestination(""); setNote(""); setNextStatus("");
      await refresh(true);
      setNotice("Action saved. Public updates are visible to the requester; internal notes remain private.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this action."); }
    finally { setBusy(false); }
  }

  if (loading && !request) return <p role="status">Loading rescue request…</p>;
  if (!request) return <div role="alert">{error || "Rescue request unavailable."} <Link href="/admin/rescue-requests" className="underline">Back to queue</Link></div>;
  const terminal = TERMINAL_RESCUE_STATUSES.includes(request.status);
  const canAssignOwner = request.workflowVersion === 1 ? ["triaged", "assigned"].includes(request.status) : ["under_review", "awaiting_responder", "responder_confirmed", "dispatched", "en_route", "on_scene", "resolved"].includes(request.status);
  const legacyReconciliation = request.workflowVersion === 1 && ["triaged", "assigned", "en_route", "on_scene"].includes(request.status);
  const allowed = legacyReconciliation ? ["under_review", ...(RESCUE_TRANSITIONS[request.status] ?? []).filter((status) => EXCEPTIONAL_RESCUE_STATUSES.includes(status as typeof EXCEPTIONAL_RESCUE_STATUSES[number]))] : (RESCUE_TRANSITIONS[request.status] ?? []);
  const triagedAt = request.events.find((event) => ["triaged", "awaiting_responder"].includes(event.nextStatus ?? ""))?.createdAt;
  const dispatchAt = request.events.find((event) => event.nextStatus === "dispatched")?.createdAt;
  const reasonRequired = ["cancelled", "duplicate", "referred", "unable_to_contact", "closed"].includes(nextStatus) || (legacyReconciliation && nextStatus === "under_review") || (nextStatus === "awaiting_responder" && !request.caseOwnerUserId && !caseOwnerUserId);
  const transitionReady = nextStatus && (!reasonRequired || reason.trim().length >= 10) &&
    (nextStatus !== "awaiting_responder" || triageNote.trim().length >= 10) &&
    (nextStatus !== "dispatched" || dispatchMethod) &&
    (nextStatus !== "resolved" || (outcomeCode && outcome.trim().length >= 10 && occurredAt)) &&
    (nextStatus !== "duplicate" || duplicateRequestId.trim()) &&
    (nextStatus !== "referred" || referralDestination.trim().length >= 3);
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
        <p><strong>First triage:</strong> {triagedAt ? new Date(triagedAt).toLocaleString("en-PH") : "Not yet"}</p><p><strong>Dispatch recorded:</strong> {dispatchAt ? new Date(dispatchAt).toLocaleString("en-PH") : "Not recorded"}{request.workflowVersion === 1 && ["en_route", "on_scene", "completed"].includes(request.status) ? " · Legacy status has no separate dispatch evidence" : ""}</p>
        <p><strong>Case owner:</strong> {operators.find((operator) => operator.id === request.caseOwnerUserId)?.displayName ?? operators.find((operator) => operator.id === request.caseOwnerUserId)?.email ?? request.caseOwnerUserId ?? "Unassigned"}</p>
        {request.confirmedTeamReference && <p><strong>Legacy team reference:</strong> {request.confirmedTeamReference}</p>}
        <p><strong>People:</strong> {request.peopleCount} · <strong>For:</strong> {request.forWhom}{request.assistedPersonName ? ` (${request.assistedPersonName})` : ""}</p>
        <p><strong>Contact:</strong> {request.primaryContact}{request.alternateContact ? ` · Alternate: ${request.alternateContact}` : ""}</p>
        <p><strong>Location:</strong> {request.locationName}, {request.barangay}, {BULACAN_LOCALITIES.find((place) => place.code === request.localityCode)?.name ?? "Bulacan"} ({request.locationUncertainty})</p>
        <p><strong>Needs:</strong> {request.vulnerabilityTags.length ? request.vulnerabilityTags.join(", ") : "None selected"}{request.vulnerabilityNotes ? ` · ${request.vulnerabilityNotes}` : ""}</p>
        <p className="whitespace-pre-wrap"><strong>Description:</strong> {request.description}</p>{request.outcome && <p className="whitespace-pre-wrap"><strong>Outcome:</strong> {request.outcome}</p>}
      </section>
      <section className="space-y-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-lg font-semibold">Operational actions</h3>
        {terminal ? <p>This request is closed. No further actions are allowed.</p> : <>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Priority<select disabled={busy || needsReview} value={priority} onChange={(event) => setPriority(event.target.value)} className={field}>{["routine", "urgent", "critical"].map((value) => <option key={value}>{value}</option>)}</select></label><button disabled={busy || needsReview || priority === request.priority} onClick={() => void act({ action: "priority", priority })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Update priority</button></div>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Case owner (administrator, not responder)<select disabled={busy || needsReview} value={caseOwnerUserId} onChange={(event) => setCaseOwnerUserId(event.target.value)} className={field}><option value="">Choose administrator</option>{operators.map((operator) => <option key={operator.id} value={operator.id}>{operator.displayName ?? operator.email}</option>)}</select></label><button disabled={busy || needsReview || !caseOwnerUserId || !canAssignOwner || caseOwnerUserId === request.caseOwnerUserId} onClick={() => void act({ action: "assign", caseOwnerUserId })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">{request.caseOwnerUserId ? "Reassign case owner" : "Assign case owner"}</button></div>
          <div className="space-y-2 border-b border-[var(--color-border)] pb-4"><label className="block text-sm">Lifecycle step<select value={nextStatus} onChange={(event) => setNextStatus(event.target.value)} className={field}><option value="">Choose next step</option>{allowed.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
            {legacyReconciliation && <p className="text-xs text-[var(--color-muted-foreground)]">Legacy status is preserved in history. Reconcile it with a reason before recording new dispatch stages.</p>}
            {nextStatus === "awaiting_responder" && <label className="block text-sm">Triage needs and notes<textarea value={triageNote} onChange={(event) => setTriageNote(event.target.value)} maxLength={2000} className={field} /></label>}
            {reasonRequired && <label className="block text-sm">{nextStatus === "awaiting_responder" ? "Why the case is unassigned (internal)" : "Reason or final documentation (internal)"}<textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000} className={field} /></label>}
            {nextStatus === "dispatched" && <label className="block text-sm">Admin-recorded dispatch confirmation method<select value={dispatchMethod} onChange={(event) => setDispatchMethod(event.target.value)} className={field}><option value="">Choose method</option>{["phone", "sms_logged", "radio", "other"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>}
            {["en_route", "on_scene", "resolved"].includes(nextStatus) && <label className="block text-sm">Reported occurrence time{nextStatus === "resolved" ? " (required)" : " (optional)"}<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} className={field} /></label>}
            {nextStatus === "resolved" && <><label className="block text-sm">Outcome code<select value={outcomeCode} onChange={(event) => setOutcomeCode(event.target.value)} className={field}><option value="">Choose outcome</option>{RESCUE_OUTCOMES.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><label className="block text-sm">Resolution description<textarea value={outcome} onChange={(event) => setOutcome(event.target.value)} maxLength={1000} className={field} /></label></>}
            {nextStatus === "duplicate" && <label className="block text-sm">Existing request ID<input value={duplicateRequestId} onChange={(event) => setDuplicateRequestId(event.target.value)} maxLength={100} className={field} /></label>}
            {nextStatus === "referred" && <label className="block text-sm">Referral destination<input value={referralDestination} onChange={(event) => setReferralDestination(event.target.value)} maxLength={160} className={field} /></label>}
            <button disabled={busy || needsReview || !transitionReady} onClick={() => { if (["dispatched", "resolved", "closed", "cancelled", "duplicate", "referred", "unable_to_contact"].includes(nextStatus) && !window.confirm(`Record ${nextStatus.replaceAll("_", " ")} for this request?`)) return; void act({ action: "lifecycle", actionKey: crypto.randomUUID(), nextStatus, ...(reasonRequired ? { reason } : {}), ...(nextStatus === "awaiting_responder" ? { note: triageNote, ...(caseOwnerUserId && caseOwnerUserId !== request.caseOwnerUserId ? { caseOwnerUserId } : {}) } : {}), ...(nextStatus === "dispatched" ? { dispatchMethod } : {}), ...(["en_route", "on_scene", "resolved"].includes(nextStatus) && occurredAt ? { occurredAt: new Date(occurredAt).toISOString() } : {}), ...(nextStatus === "resolved" ? { outcomeCode, outcome } : {}), ...(nextStatus === "duplicate" ? { duplicateRequestId } : {}), ...(nextStatus === "referred" ? { referralDestination } : {}) }); }} className="rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Record lifecycle step</button>
          </div>
          <div className="space-y-2"><label className="block text-sm">Note<textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={2000} className={field} /></label><label className="block text-sm">Visibility<select value={visibility} onChange={(event) => setVisibility(event.target.value)} className={field}><option value="internal">Internal only</option><option value="public">Visible to requester</option></select></label><button disabled={busy || needsReview || !note.trim()} onClick={() => void act({ action: "note", note, visibility })} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50">Add note</button></div>
        </>}
      </section>
    </div>
    <AdminRescueCoordination requestId={request.id} version={request.version} status={request.status} localityCode={request.localityCode} assignments={request.assignments ?? []} disabled={busy || needsReview || stale} onSaved={() => refresh(true)} />
    <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h3 className="text-lg font-semibold">Event history</h3><ol className="mt-4 space-y-4">{request.events.map((event) => <li key={event.id} className="border-l-2 border-[var(--color-border)] pl-4 text-sm"><p className="font-semibold">{event.eventType.replaceAll("_", " ")}{event.previousStatus !== event.nextStatus ? ` · ${event.previousStatus ?? "start"} → ${event.nextStatus ?? "unknown"}` : ""}</p><p className="text-xs text-[var(--color-muted-foreground)]">Recorded {new Date(event.createdAt).toLocaleString("en-PH")}{event.occurredAt ? ` · Reported occurrence ${new Date(event.occurredAt).toLocaleString("en-PH")}` : ""} · {event.visibility === "internal" ? "Internal only" : "Requester-visible"}</p>{event.reason && <p className="mt-1 whitespace-pre-wrap">Reason: {event.reason}</p>}{event.details?.triageNote && <p className="mt-1 whitespace-pre-wrap">Triage: {event.details.triageNote}</p>}{event.details?.outcomeCode && <p className="mt-1">Outcome: {event.details.outcomeCode.replaceAll("_", " ")}</p>}{event.note && <p className="mt-1 whitespace-pre-wrap">{event.note}</p>}</li>)}</ol></section>
  </div>;
}
