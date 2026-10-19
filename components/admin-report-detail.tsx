"use client";
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { ADMIN_REPORT_STATUS_TRANSITIONS, type AdminReportStatus } from "@/lib/admin-contracts";

type Action = { id: string; actionType: string; previousValue: string | null; nextValue: string | null; visibility: string; note: string | null; actorName: string; createdAt: string };
type Detail = {
  title: string; description: string; locationName: string; latitude: number; longitude: number;
  locationSource: string; gpsAccuracyMeters: number | null; gpsCapturedAt: string | null;
  photoCapturedAt: string | null; onsiteEligibleAt: string | null; onsitePolicyVersion: string | null;
  publicStatus: string; adminStatus: AdminReportStatus; severity: string; incidentId: string;
  imageUrl: string | null; verificationStatus: string; reviewVersion: number; updatedAt: string;
  reviewedAt: string | null; reviewer: { displayName: string | null; email: string } | null;
  createdAt: string; confirmationCount: number; resolvedCount: number;
  user: { displayName: string | null; email: string } | null;
  incident: { reportCount: number; reports: Array<{ id: string; title: string; verificationStatus: string; locationName: string }> };
  nearbyReports: Array<{ id: string; title: string; locationName: string; verificationStatus: string; distanceMeters: number }>;
  confirmations: Array<{ id: string; confirmationType: string; createdAt: string }>;
  actions: Action[];
};

const fieldClass = "mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm";
const time = (value: string | null | undefined) => value ? new Date(value).toLocaleString("en-PH") : "Not recorded";
const captureAge = (capturedAt: string | null, submittedAt: string) => {
  if (!capturedAt) return "";
  const seconds = Math.round((Date.parse(submittedAt) - Date.parse(capturedAt)) / 1000);
  return Number.isFinite(seconds) ? ` · ${Math.abs(seconds)} s ${seconds < 0 ? "after" : "before"} submission` : " · time unavailable";
};

export function AdminReportDetail({ reportId }: { reportId: string }) {
  const [report, setReport] = useState<Detail | null>(null);
  const [reviewState, setReviewState] = useState("");
  const [operationState, setOperationState] = useState("");
  const [reason, setReason] = useState("");
  const [publicMessage, setPublicMessage] = useState("");
  const [note, setNote] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "public">("internal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/reports/${reportId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to load report.");
      const next = body.data.report as Detail;
      setReport(next);
      setReviewState(next.verificationStatus);
      setOperationState(next.adminStatus);
      setError(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to load report."); }
  }, [reportId]);
  // Fetch starts the external request; state updates finish after the network boundary.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  async function mutate(path: "verification" | "status" | "notes", body: Record<string, unknown>, message: string) {
    setSaving(true); setError(null); setSuccess(null);
    try {
      const response = await fetch(`/api/admin/reports/${reportId}/${path}`, { method: path === "notes" ? "POST" : "PATCH", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) {
        if (response.status === 409) await load();
        throw new Error(payload.error ?? "Unable to save changes.");
      }
      await load();
      if (path === "notes") setNote("");
      if (path === "verification") { setReason(""); setPublicMessage(""); }
      setSuccess(message);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to save changes."); }
    finally { setSaving(false); }
  }

  if (!report) return <div className="p-6 text-sm">{error ? <><p role="alert">{error}</p><button type="button" onClick={() => void load()} className="mt-3 rounded border px-3 py-2">Retry</button></> : "Loading report..."}</div>;
  const allowedOperations = [report.adminStatus, ...ADMIN_REPORT_STATUS_TRANSITIONS[report.adminStatus]].filter((status) => status !== "verified" && status !== "rejected");

  return <main className="bg-[var(--color-background)] p-4 sm:p-8"><div className="mx-auto max-w-5xl space-y-5">
    <Link href="/admin/reports" className="inline-flex items-center gap-1 text-sm text-[var(--color-muted-foreground)]"><ArrowLeft className="h-4 w-4" />Reports monitoring</Link>
    {error ? <p role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p> : null}
    {success ? <p role="status" className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300">{success}</p> : null}
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">{report.title}</h1><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{report.locationName} · {report.latitude}, {report.longitude}</p></div><button type="button" onClick={() => void load()} disabled={saving} className="inline-flex items-center gap-2 rounded border border-[var(--color-border)] px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Refresh</button></div>
      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[var(--color-muted-foreground)]">Reporter</dt><dd>{report.user?.displayName ?? report.user?.email ?? "Legacy anonymous"}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Community confirmation</dt><dd>{report.confirmationCount} confirmed · {report.resolvedCount} receded</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Admin verification</dt><dd className="capitalize">{report.verificationStatus}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Operational / public status</dt><dd>{report.adminStatus.replaceAll("_", " ")} / {report.publicStatus}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Submitted</dt><dd>{time(report.createdAt)}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Last reviewed</dt><dd>{time(report.reviewedAt)}{report.reviewer ? ` by ${report.reviewer.displayName ?? report.reviewer.email}` : ""}</dd></div></dl>
      <p className="mt-6 whitespace-pre-wrap text-sm leading-6">{report.description}</p>{report.imageUrl ? <img src={report.imageUrl} alt="Submitted report evidence" className="mt-5 max-h-[420px] w-full rounded-lg object-contain" /> : <p className="mt-5 text-sm text-amber-300">No photo attached.</p>}
    </section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Evidence and incident context</h2><dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-[var(--color-muted-foreground)]">Location source / GPS accuracy</dt><dd>{report.locationSource} · {report.gpsAccuracyMeters === null ? "Unknown" : `${report.gpsAccuracyMeters} m`}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">GPS fix recorded</dt><dd>{time(report.gpsCapturedAt)}{captureAge(report.gpsCapturedAt, report.createdAt)}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Photo captured</dt><dd>{time(report.photoCapturedAt)}{captureAge(report.photoCapturedAt, report.createdAt)}</dd></div><div><dt className="text-[var(--color-muted-foreground)]">Onsite eligibility</dt><dd>{report.onsiteEligibleAt ? `${time(report.onsiteEligibleAt)} · ${report.onsitePolicyVersion}` : "Not established (legacy/admin/insufficient evidence)"}</dd></div></dl><p className="mt-4 text-sm">Incident {report.incidentId} · {report.incident.reportCount} included reports</p><ul className="mt-2 space-y-1 text-sm">{report.incident.reports.filter((entry) => entry.id !== reportId).map((entry) => <li key={entry.id}><Link href={`/admin/reports/${entry.id}`} className="text-[var(--color-primary)] hover:underline">{entry.title}</Link> · {entry.locationName} · {entry.verificationStatus}</li>)}</ul><h3 className="mt-4 text-sm font-semibold">Other reports within 500 m</h3>{report.nearbyReports.length ? <ul className="mt-2 space-y-1 text-sm">{report.nearbyReports.map((entry) => <li key={entry.id}><Link href={`/admin/reports/${entry.id}`} className="text-[var(--color-primary)] hover:underline">{entry.title}</Link> · {entry.distanceMeters} m · {entry.verificationStatus}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">No nearby reports found.</p>}<p className="mt-4 text-xs text-[var(--color-muted-foreground)]">Capture metadata is evidence to review, not proof of physical presence. Related reports share this incident; review their locations before deciding.</p></section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Verification decision</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Record the evidence in an internal reason. Optional public feedback is shown separately and must contain no private details.</p><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm">Decision<select disabled={saving} value={reviewState} onChange={(event) => setReviewState(event.target.value)} className={fieldClass}>{["unreviewed", "verified", "disputed", "rejected"].map((value) => <option key={value} value={value}>{value}</option>)}</select></label><div className="text-sm">Last reviewer<p className="mt-2">{report.reviewer?.displayName ?? report.reviewer?.email ?? "None recorded"}</p></div></div><label className="mt-4 block text-sm">Internal evidence/reason<textarea disabled={saving} value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={2000} className={fieldClass} placeholder="What evidence supports this decision?" /></label><label className="mt-4 block text-sm">Public feedback (optional)<textarea disabled={saving} value={publicMessage} onChange={(event) => setPublicMessage(event.target.value)} rows={2} maxLength={500} className={fieldClass} placeholder="Safe explanation for the reporter" /></label><button type="button" disabled={saving || reviewState === report.verificationStatus || reason.trim().length < 10} onClick={() => { if (!report) return; if (reviewState === "rejected" && !window.confirm("Reject this report and remove it from public listings?")) return; void mutate("verification", { verificationStatus: reviewState, expectedReviewVersion: report.reviewVersion, expectedUpdatedAt: report.updatedAt, reason, publicMessage }, "Review decision recorded."); }} className="mt-4 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving..." : "Record decision"}</button></section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Operational status</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">This tracks operations. It does not verify evidence or count community confirmations.</p><div className="mt-3 flex flex-wrap items-end gap-3"><label className="min-w-[220px] flex-1 text-sm">Status<select disabled={saving} value={operationState} onChange={(event) => setOperationState(event.target.value)} className={fieldClass}>{allowedOperations.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><button type="button" disabled={saving || operationState === report.adminStatus} onClick={() => { if (["resolved", "closed"].includes(operationState) && !window.confirm(`Confirm ${operationState}?`)) return; void mutate("status", { status: operationState, expectedUpdatedAt: report.updatedAt }, "Operational status updated."); }} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50">Save status</button></div></section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Add operational note</h2><label className="mt-3 block text-sm">Note<textarea disabled={saving} value={note} onChange={(event) => setNote(event.target.value)} rows={3} maxLength={2000} className={fieldClass} /></label><div className="mt-3 flex flex-wrap items-end gap-3"><label className="text-sm">Visibility<select disabled={saving} value={visibility} onChange={(event) => setVisibility(event.target.value as "internal" | "public")} className={fieldClass}><option value="internal">Internal</option><option value="public">Public</option></select></label><button type="button" disabled={saving || !note.trim()} onClick={() => void mutate("notes", { note, visibility }, "Note saved.")} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm disabled:opacity-50">Save note</button></div></section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Review and operational history</h2>{report.actions.length ? <ol className="mt-4 space-y-3">{report.actions.map((action) => <li key={action.id} className="border-l-2 border-[var(--color-primary)] pl-3 text-sm"><p className="font-medium">{action.actionType.replaceAll("_", " ")}{action.previousValue || action.nextValue ? `: ${action.previousValue ?? ""} → ${action.nextValue ?? ""}` : ""}</p>{action.note ? <p className="mt-1 whitespace-pre-wrap text-[var(--color-muted-foreground)]">{action.note}</p> : null}<time className="mt-1 block text-xs text-[var(--color-muted-foreground)]">{time(action.createdAt)} · {action.actorName} · {action.visibility}</time></li>)}</ol> : <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">No actions recorded yet.</p>}</section>
    <section className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-5"><h2 className="font-semibold">Community activity</h2>{report.confirmations.length ? <ul className="mt-3 space-y-1 text-sm">{report.confirmations.map((entry) => <li key={entry.id}>{entry.confirmationType} · {time(entry.createdAt)}</li>)}</ul> : <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">No community confirmations recorded.</p>}</section>
  </div></main>;
}
