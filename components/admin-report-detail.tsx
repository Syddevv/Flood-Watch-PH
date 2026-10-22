"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowLeft, ImageIcon, MapPin, RefreshCw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { ADMIN_REPORT_STATUS_TRANSITIONS, type AdminReportStatus } from "@/lib/admin-contracts";
import { getReviewDecisionBlockReason, MIN_REVIEW_REASON_LENGTH, parseReviewDecision, REPORT_VERIFICATION_STATES } from "@/lib/report-review";
import { formatUiLabel } from "@/lib/ui-labels";

type Action = { id: string; actionType: string; previousValue: string | null; nextValue: string | null; visibility: string; note: string | null; actorName: string; createdAt: string };
type Detail = {
  title: string; description: string; locationName: string; latitude: number; longitude: number;
  locationSource: string; gpsAccuracyMeters: number | null; gpsCapturedAt: string | null;
  photoCapturedAt: string | null; onsiteEligibleAt: string | null; onsitePolicyVersion: string | null;
  publicStatus: string; adminStatus: AdminReportStatus; severity: string; incidentId: string;
  imageUrl: string | null; verificationStatus: string; reviewVersion: number; updatedAt: string;
  reviewedAt: string | null; reviewer: { displayName: string | null; email: string } | null;
  createdAt: string; confirmationCount: number; resolvedCount: number;
  user: { id: string; fullName: string | null; email: string; fullAddress: string | null; barangay: string | null; cityMunicipality: string | null; province: string | null; emailVerificationStatus: string } | null;
  incident: { reportCount: number; reports: Array<{ id: string; title: string; verificationStatus: string; locationName: string }> };
  nearbyReports: Array<{ id: string; title: string; locationName: string; verificationStatus: string; distanceMeters: number }>;
  confirmations: Array<{ id: string; confirmationType: string; createdAt: string }>;
  actions: Action[];
};
type Scope = "verification" | "status" | "notes";
type Feedback = { scope: Scope; kind: "success" | "error"; message: string };

const panelClass = "min-w-0 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6";
const fieldClass = "mt-1 min-h-11 w-full min-w-0 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]";
const mutedClass = "text-[var(--color-muted-foreground)]";
const time = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-PH") : "Not recorded";

function captureAge(capturedAt: string | null, submittedAt: string) {
  if (!capturedAt) return "";
  const seconds = Math.round((Date.parse(submittedAt) - Date.parse(capturedAt)) / 1000);
  return Number.isFinite(seconds) ? " · " + Math.abs(seconds) + " s " + (seconds < 0 ? "after" : "before") + " submission" : " · time unavailable";
}

function InfoField({ label, children }: { label: string; children: ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt><dd className="mt-1 break-words text-sm font-medium">{children}</dd></div>;
}

function ActionFeedback({ feedback, scope }: { feedback: Feedback | null; scope: Scope }) {
  if (!feedback || feedback.scope !== scope) return null;
  return <p role={feedback.kind === "error" ? "alert" : "status"} className={"mt-3 rounded-xl border px-3 py-2 text-xs " + (feedback.kind === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200")}>{feedback.message}</p>;
}

export function AdminReportDetail({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Detail | null>(null);
  const [reviewState, setReviewState] = useState("");
  const [operationState, setOperationState] = useState("");
  const [reason, setReason] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [saving, setSaving] = useState<Scope | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [reasonTouched, setReasonTouched] = useState(false);
  const photoDialogRef = useRef<HTMLDialogElement>(null);
  const photoTriggerRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reports/" + reportId, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load report.");
      const next = body.data.report as Detail;
      setReport(next);
      setReviewState(next.verificationStatus);
      setOperationState(next.adminStatus);
      setError(null);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load report.");
      return false;
    }
  }, [reportId]);

  // Fetch starts the external request; state updates finish after the network boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: Scope, body: Record<string, unknown>, successMessage: string) {
    if (saving) return;
    setSaving(path);
    setError(null);
    setFeedback(null);
    try {
      const response = await fetch("/api/admin/reports/" + reportId + "/" + path, {
        method: path === "notes" ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Origin: window.location.origin },
        body: JSON.stringify(body),
      });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(payload.error ?? "Unable to save changes. Review the form and try again.");
      }
      if (!await load()) throw new Error("Changes were saved, but the report could not be refreshed. Use Refresh to load the latest state.");
      if (path === "notes") setNote("");
      if (path === "verification") {
        setReason("");
        setPublicMessage("");
        setReasonTouched(false);
      }
      setFeedback({ scope: path, kind: "success", message: successMessage });
    } catch (cause) {
      setFeedback({ scope: path, kind: "error", message: cause instanceof Error ? cause.message : "Unable to save changes. Try again." });
    } finally {
      setSaving(null);
    }
  }

  if (!report) return <main className="p-6 text-sm">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded border px-3 py-2">Retry</button></> : <p role="status">Loading report...</p>}</main>;

  const allowedOperations = [report.adminStatus, ...ADMIN_REPORT_STATUS_TRANSITIONS[report.adminStatus]].filter((status) => status === report.adminStatus || status !== "verified" && status !== "rejected");
  const reviewDecision = { verificationStatus: reviewState, expectedReviewVersion: report.reviewVersion, expectedUpdatedAt: report.updatedAt, reason, publicMessage };
  const reviewResult = parseReviewDecision(reviewDecision);
  const reviewDisabledReason = getReviewDecisionBlockReason(report.verificationStatus, reviewDecision);
  const reasonTooShort = reason.trim().length < MIN_REVIEW_REASON_LENGTH;
  const publicError = !reasonTooShort && reviewResult.error && !reviewResult.error.includes("review change") ? reviewResult.error : null;
  const statusDisabledReason = operationState === report.adminStatus ? "Choose a different operational status to save." : !allowedOperations.some((status) => status === operationState) ? "Choose an allowed status transition." : null;
  const noteDisabledReason = !note.trim() ? "Enter a note before saving." : null;
  const relatedReports = report.incident.reports.filter((entry) => entry.id !== reportId);

  return <main className="min-w-0 bg-[var(--color-background)] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
    <div className="mx-auto w-full max-w-[1440px] space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><Link href="/admin/reports" className="inline-flex min-h-10 items-center gap-2 text-sm text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><ArrowLeft aria-hidden="true" className="size-4" />Reports monitoring</Link><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-primary)]">Report review</p></div>
        <button type="button" onClick={() => void load()} disabled={Boolean(saving)} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--color-border)] px-3 text-sm font-medium hover:bg-[var(--color-panel)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><RefreshCw aria-hidden="true" className="size-4" />Refresh</button>
      </div>
      {error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(340px,1fr)]">
        <div className="min-w-0 space-y-5">
          <section className={panelClass} aria-labelledby="report-overview-title">
            <h1 id="report-overview-title" className="text-xl font-semibold leading-tight sm:text-2xl">{report.title}</h1>
            <p className={"mt-2 flex items-start gap-2 text-sm " + mutedClass}><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />{report.locationName}</p>
            <dl className="mt-5 grid gap-x-5 gap-y-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Reporter">{report.user?.fullName ?? "Reporter information unavailable"}</InfoField>
              <InfoField label="Admin verification">{formatUiLabel(report.verificationStatus)}</InfoField>
              <InfoField label="Community confirmation">{report.confirmationCount} confirmed · {report.resolvedCount} receded</InfoField>
              <InfoField label="Operational / public status">{formatUiLabel(report.adminStatus)} / {report.publicStatus}</InfoField>
              <InfoField label="Submitted">{time(report.createdAt)}</InfoField>
              <InfoField label="Last reviewed">{time(report.reviewedAt)}{report.reviewer ? " by " + (report.reviewer.displayName ?? report.reviewer.email) : ""}</InfoField>
            </dl>
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <h2 className="text-sm font-semibold">Incident description</h2>
              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{report.description}</p>
            </div>
          </section>

          <section className={panelClass} aria-labelledby="reporter-information-title">
            <h2 id="reporter-information-title" className="text-sm font-semibold">Reporter Information</h2>
            <dl className="mt-4 grid gap-x-5 gap-y-4 sm:grid-cols-2">
              <InfoField label="Full Name">{report.user?.fullName ?? "Reporter information unavailable"}</InfoField>
              <InfoField label="Email Address">{report.user?.email ?? "Unavailable"}</InfoField>
              <InfoField label="Registered Address">{report.user?.fullAddress ?? "Unavailable"}</InfoField>
              <InfoField label="Barangay">{report.user?.barangay ?? "Unavailable"}</InfoField>
              <InfoField label="City / Municipality">{report.user?.cityMunicipality ?? "Unavailable"}</InfoField>
              <InfoField label="Province">{report.user?.province ?? "Unavailable"}</InfoField>
              <InfoField label="Account Verification">{report.user?.emailVerificationStatus ? formatUiLabel(report.user.emailVerificationStatus) : "Unavailable"}</InfoField>
              <InfoField label="Submitted">{time(report.createdAt)}</InfoField>
            </dl>
          </section>

          <section className={panelClass} aria-labelledby="photo-evidence-title">
            <div className="flex items-center justify-between gap-3"><h2 id="photo-evidence-title" className="text-sm font-semibold">Photo evidence</h2>{report.photoCapturedAt ? <span className={"text-xs " + mutedClass}>Captured {time(report.photoCapturedAt)}</span> : null}</div>
            {report.imageUrl ? <button ref={photoTriggerRef} type="button" onClick={() => photoDialogRef.current?.showModal()} aria-label="Expand submitted photo evidence" className="mt-3 flex min-h-40 w-full items-center justify-center rounded-xl border border-[var(--color-border)] bg-slate-950 p-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"><img src={report.imageUrl} alt="Submitted report evidence" className="max-h-72 max-w-full object-contain" /></button> : <p className={"mt-3 flex items-center gap-2 text-sm " + mutedClass}><ImageIcon aria-hidden="true" className="size-4" />No photo attached.</p>}
            {report.imageUrl ? <p className={"mt-2 text-xs " + mutedClass}>Select the photo to inspect the full image.</p> : null}
          </section>

          <section className={panelClass} aria-labelledby="evidence-context-title">
            <h2 id="evidence-context-title" className="text-sm font-semibold">Evidence and incident context</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div><h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Location evidence</h3><dl className="mt-3 grid gap-3">
                <InfoField label="Location source">{report.locationSource}</InfoField>
                <InfoField label="GPS accuracy">{report.gpsAccuracyMeters === null ? "Unknown" : report.gpsAccuracyMeters + " m"}</InfoField>
                <InfoField label="Coordinates">{report.latitude}, {report.longitude}</InfoField>
                <InfoField label="GPS fix recorded">{time(report.gpsCapturedAt)}{captureAge(report.gpsCapturedAt, report.createdAt)}</InfoField>
              </dl></div>
              <div><h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">Capture evidence</h3><dl className="mt-3 grid gap-3">
                <InfoField label="Photo captured">{time(report.photoCapturedAt)}{captureAge(report.photoCapturedAt, report.createdAt)}</InfoField>
                <InfoField label="Onsite eligibility">{report.onsiteEligibleAt ? time(report.onsiteEligibleAt) + " · " + report.onsitePolicyVersion : "Not established (legacy/admin/insufficient evidence)"}</InfoField>
              </dl></div>
            </div>
            <div className="mt-5 border-t border-[var(--color-border)] pt-4">
              <h3 className="text-sm font-semibold">Incident context</h3>
              <p className={"mt-1 break-all text-xs " + mutedClass}>Incident {report.incidentId} · {report.incident.reportCount} included reports</p>
              {relatedReports.length ? <ul className="mt-3 space-y-2">{relatedReports.map((entry) => <li key={entry.id} className="rounded-lg border border-[var(--color-border)] p-3 text-xs"><Link href={"/admin/reports/" + entry.id} className="font-medium text-[var(--color-primary)] hover:underline">{entry.title}</Link><p className={"mt-1 " + mutedClass}>{entry.locationName} · {formatUiLabel(entry.verificationStatus)}</p></li>)}</ul> : null}
              <h4 className="mt-4 text-xs font-semibold">Other reports within 500 m</h4>
              {report.nearbyReports.length ? <ul className="mt-2 space-y-2">{report.nearbyReports.map((entry) => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-[var(--color-border)] p-3 text-xs"><Link href={"/admin/reports/" + entry.id} className="font-medium text-[var(--color-primary)] hover:underline">{entry.title}</Link><span className={mutedClass}>{entry.distanceMeters} m · {formatUiLabel(entry.verificationStatus)}</span></li>)}</ul> : <p className={"mt-2 text-xs " + mutedClass}>No nearby reports found.</p>}
              <p className={"mt-4 text-xs leading-5 " + mutedClass}>Capture metadata is evidence to review, not proof of physical presence. Related reports share this incident; review their locations before deciding.</p>
            </div>
          </section>
        </div>

        <aside className="min-w-0 space-y-5" aria-label="Review actions">
          <section className={panelClass} aria-labelledby="verification-title">
            <h2 id="verification-title" className="text-base font-semibold">Verification Decision</h2>
            <p className={"mt-1 text-xs leading-5 " + mutedClass}>Record evidence in an internal reason. Optional public feedback is shown separately and must contain no private details.</p>
            <label className="mt-4 block text-sm font-medium">Decision<select disabled={Boolean(saving)} value={reviewState} onChange={(event) => setReviewState(event.target.value)} className={fieldClass}>{REPORT_VERIFICATION_STATES.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}</select></label>
            <label className="mt-4 block text-sm font-medium">Internal evidence/reason<textarea disabled={Boolean(saving)} value={reason} onChange={(event) => setReason(event.target.value)} onBlur={() => setReasonTouched(true)} rows={4} maxLength={2000} className={fieldClass} placeholder="Describe the photo, location, or other evidence reviewed" aria-invalid={reasonTouched && reasonTooShort} /></label>
            <p className={"mt-1 text-xs " + (reasonTouched && reasonTooShort ? "text-red-300" : mutedClass)}>{reasonTooShort ? "At least " + MIN_REVIEW_REASON_LENGTH + " characters are required (" + reason.trim().length + "/" + MIN_REVIEW_REASON_LENGTH + ")." : "Internal reason is recorded for the audit history."}</p>
            <label className="mt-4 block text-sm font-medium">Public feedback (optional)<textarea disabled={Boolean(saving)} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} rows={2} maxLength={500} className={fieldClass} placeholder="A safe explanation visible to the reporter" aria-invalid={Boolean(publicError)} /></label>
            <p className={"mt-1 text-xs " + (publicError ? "text-red-300" : mutedClass)}>{publicError ?? "May be visible to citizens. Do not include contact details or links."}</p>
            <div className="mt-4 border-t border-[var(--color-border)] pt-3 text-xs"><span className={mutedClass}>Last reviewer</span><p className="mt-1">{report.reviewer?.displayName ?? report.reviewer?.email ?? "None recorded"} · {time(report.reviewedAt)}</p></div>
            <button type="button" disabled={Boolean(saving) || Boolean(reviewDisabledReason)} onClick={() => { if (reviewState === "rejected" && !window.confirm("Reject this report and remove it from public listings?")) return; void mutate("verification", { verificationStatus: reviewState, expectedReviewVersion: report.reviewVersion, expectedUpdatedAt: report.updatedAt, reason: reason.trim(), publicMessage }, "Review decision recorded."); }} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{saving === "verification" ? "Saving decision…" : "Record Decision"}</button>
            {!saving && reviewDisabledReason ? <p className={"mt-2 text-xs " + mutedClass}>{reviewDisabledReason}</p> : null}
            <ActionFeedback feedback={feedback} scope="verification" />
          </section>

          <section className={panelClass} aria-labelledby="operational-status-title">
            <h2 id="operational-status-title" className="text-sm font-semibold">Operational Status</h2>
            <p className={"mt-1 text-xs leading-5 " + mutedClass}>Operational status tracks response progress separately from evidence verification.</p>
            <p className="mt-3 text-xs">Current: <strong>{formatUiLabel(report.adminStatus)}</strong> · Public: {report.publicStatus}</p>
            <label className="mt-3 block text-sm font-medium">Status<select disabled={Boolean(saving)} value={operationState} onChange={(event) => setOperationState(event.target.value)} className={fieldClass}>{allowedOperations.map((value) => <option key={value} value={value}>{formatUiLabel(value)}</option>)}</select></label>
            <button type="button" disabled={Boolean(saving) || Boolean(statusDisabledReason)} onClick={() => { if (["resolved", "closed"].includes(operationState) && !window.confirm("Confirm " + operationState + "?")) return; void mutate("status", { status: operationState, expectedUpdatedAt: report.updatedAt }, "Operational status updated."); }} className="mt-3 min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-panel)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{saving === "status" ? "Saving status…" : "Save status"}</button>
            {!saving && statusDisabledReason ? <p className={"mt-2 text-xs " + mutedClass}>{statusDisabledReason}</p> : null}
            <ActionFeedback feedback={feedback} scope="status" />
          </section>

          <section className={panelClass} aria-labelledby="operational-note-title">
            <h2 id="operational-note-title" className="text-sm font-semibold">Add operational note</h2>
            <label className="mt-3 block text-sm font-medium">Note<textarea disabled={Boolean(saving)} value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} className={fieldClass} placeholder="Record an operational update" /></label>
            <label className="mt-3 block text-sm font-medium">Visibility<select disabled={Boolean(saving)} value={visibility} onChange={(event) => setVisibility(event.target.value as "internal" | "public")} className={fieldClass}><option value="internal">Internal</option><option value="public">Public</option></select></label>
            <p className={"mt-1 text-xs " + mutedClass}>{visibility === "public" ? "Public notes may be shown to citizens. Do not include private details." : "Internal notes stay in the admin review history."}</p>
            <button type="button" disabled={Boolean(saving) || Boolean(noteDisabledReason)} onClick={() => void mutate("notes", { note: note.trim(), visibility }, "Note saved.")} className="mt-3 min-h-11 rounded-xl border border-[var(--color-border)] px-4 text-sm font-semibold hover:bg-[var(--color-panel)] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]">{saving === "notes" ? "Saving note…" : "Save note"}</button>
            {!saving && noteDisabledReason ? <p className={"mt-2 text-xs " + mutedClass}>{noteDisabledReason}</p> : null}
            <ActionFeedback feedback={feedback} scope="notes" />
          </section>
        </aside>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={panelClass} aria-labelledby="review-history-title"><h2 id="review-history-title" className="text-sm font-semibold">Review and operational history</h2>{report.actions.length ? <ol className="mt-4 space-y-4">{report.actions.map((action) => <li key={action.id} className="border-l-2 border-[var(--color-primary)] pl-3 text-sm"><p className="font-medium">{formatUiLabel(action.actionType)}{action.previousValue || action.nextValue ? ": " + (action.previousValue ? formatUiLabel(action.previousValue) : "") + " → " + (action.nextValue ? formatUiLabel(action.nextValue) : "") : ""}</p>{action.note ? <p className={"mt-1 whitespace-pre-wrap break-words " + mutedClass}>{action.note}</p> : null}<time className={"mt-1 block text-xs " + mutedClass}>{time(action.createdAt)} · {action.actorName} · {formatUiLabel(action.visibility)}</time></li>)}</ol> : <p className={"mt-3 text-sm " + mutedClass}>No review or operational actions have been recorded.</p>}</section>
        <section className={panelClass} aria-labelledby="community-activity-title"><h2 id="community-activity-title" className="text-sm font-semibold">Community activity</h2><p className={"mt-1 text-xs " + mutedClass}>Community confirmations are separate from admin verification.</p>{report.confirmations.length ? <ul className="mt-4 space-y-2 text-sm">{report.confirmations.map((entry) => <li key={entry.id} className="rounded-lg border border-[var(--color-border)] p-3">{entry.confirmationType}<time className={"mt-1 block text-xs " + mutedClass}>{time(entry.createdAt)}</time></li>)}</ul> : <p className={"mt-3 text-sm " + mutedClass}>No community confirmations recorded.</p>}</section>
      </div>
    </div>

    {report.imageUrl ? <dialog ref={photoDialogRef} aria-label="Full submitted photo evidence" onClose={() => photoTriggerRef.current?.focus()} onClick={(event) => { if (event.target === event.currentTarget) event.currentTarget.close(); }} className="m-auto max-h-[calc(100dvh-2rem)] max-w-[calc(100vw-2rem)] overflow-auto rounded-xl border border-[var(--color-border)] bg-slate-950 p-3 text-white backdrop:bg-slate-950/85"><div className="flex justify-end"><button type="button" onClick={() => photoDialogRef.current?.close()} aria-label="Close photo preview" className="mb-2 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"><X aria-hidden="true" className="size-5" /></button></div><img src={report.imageUrl} alt="Full submitted report evidence" className="max-h-[calc(100dvh-7rem)] max-w-[calc(100vw-4rem)] object-contain" /></dialog> : null}
  </main>;
}
