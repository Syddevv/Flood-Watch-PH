"use client";

import Link from "next/link";
import { Check, ExternalLink, Settings2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ADMIN_SETTINGS_DEFAULTS, type AdminSettingsValues } from "@/lib/admin-settings-config";

type Tab = "general" | "reports" | "notifications" | "security";
const tabs: { id: Tab; label: string }[] = [
  { id: "general", label: "General" }, { id: "reports", label: "Flood Reports" },
  { id: "notifications", label: "Notifications" }, { id: "security", label: "Data & Security" },
];
const selectClass = "mt-2 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm text-[var(--color-foreground)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]";

function SettingToggle({ title, detail, checked, onChange }: { title: string; detail: string; checked: boolean; onChange: () => void }) {
  return <div className="flex items-center justify-between gap-5 border-t border-[var(--color-border)] py-4 first:border-0">
    <div className="min-w-0"><h4 className="text-sm font-semibold">{title}</h4><p className="mt-1 text-xs leading-relaxed text-[var(--color-muted-foreground)]">{detail}</p></div>
    <button type="button" role="switch" aria-label={title} aria-checked={checked} onClick={onChange} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] ${checked ? "bg-[var(--color-primary)]" : "bg-slate-600"}`}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : ""}`} /></button>
  </div>;
}

export function AdminSettings() {
  const [tab, setTab] = useState<Tab>("general");
  const [values, setValues] = useState<AdminSettingsValues>({ ...ADMIN_SETTINGS_DEFAULTS });
  const [saved, setSaved] = useState<AdminSettingsValues>({ ...ADMIN_SETTINGS_DEFAULTS });
  const [version, setVersion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const dirty = JSON.stringify(values) !== JSON.stringify(saved);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/settings", { cache: "no-store", signal: controller.signal });
        const body = await response.json();
        if (!response.ok || !body.data) throw new Error(body.error ?? "Could not load settings.");
        setValues(body.data.values as AdminSettingsValues);
        setSaved(body.data.values as AdminSettingsValues);
        setVersion(body.data.version as string);
      } catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load settings."); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function update<K extends keyof AdminSettingsValues>(key: K, value: AdminSettingsValues[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    setSuccess(false);
  }
  async function save() {
    setSaving(true); setError(""); setSuccess(false);
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values, version }) });
      const body = await response.json();
      if (!response.ok || !body.data) throw new Error(body.error ?? "Could not save settings.");
      setSaved(body.data.values as AdminSettingsValues);
      setVersion(body.data.version as string);
      setSuccess(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save settings."); }
    finally { setSaving(false); }
  }

  return <div className="mx-auto max-w-[900px] space-y-5 pb-12">
    <div><p className="text-xs font-bold tracking-[.16em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Administration Settings</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Manage Flood Watch monitoring and in-app notifications.</p></div>
    <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-semibold">Administration Settings</h3><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Configuration applies to all administrators.</p></div><Settings2 aria-hidden="true" className="h-5 w-5 text-[var(--color-muted-foreground)]" /></div>
      <div role="tablist" aria-label="Settings sections" className="mt-5 flex flex-wrap gap-2 border-b border-[var(--color-border)] pb-5">{tabs.map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${tab === item.id ? "border-[var(--color-primary)] bg-[var(--color-primary)] text-white" : "border-[var(--color-border)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"}`}>{item.label}</button>)}</div>
      {loading ? <p role="status" className="py-8 text-sm text-[var(--color-muted-foreground)]">Loading settings…</p> : !version ? <div className="py-6 text-sm"><p role="alert" className="text-[var(--color-danger)]">{error || "Settings are unavailable."}</p><button type="button" onClick={() => window.location.reload()} className="mt-3 font-semibold text-[var(--color-primary)] underline">Retry</button></div> : <div role="tabpanel" className="py-5">
        {tab === "general" && <div><h4 className="font-semibold">Application Information</h4><div className="mt-4 divide-y divide-[var(--color-border)] text-sm"><div className="flex justify-between gap-4 py-3"><span className="text-[var(--color-muted-foreground)]">Application</span><strong>Flood Watch</strong></div><div className="flex justify-between gap-4 py-3"><span className="text-[var(--color-muted-foreground)]">Coverage area</span><strong>Bulacan, Philippines</strong></div></div></div>}
        {tab === "reports" && <div><h4 className="font-semibold">Flood Report Preferences</h4><label className="mt-5 block text-sm font-semibold">Recent Reports Window<select value={values.recentReportHours} onChange={(event) => update("recentReportHours", Number(event.target.value) as AdminSettingsValues["recentReportHours"])} className={selectClass}><option value={24}>Last 24 hours</option><option value={48}>Last 48 hours</option><option value={72}>Last 72 hours</option><option value={168}>Last 7 days</option></select><span className="mt-1.5 block text-xs font-normal text-[var(--color-muted-foreground)]">Controls recent reports on the Overview and Live Operations Map. Historical reports remain available.</span></label><div className="mt-5"><SettingToggle title="Pending Report Reminders" detail="Create one in-app reminder per pending report when an administrator opens Notifications." checked={values.pendingReportReminders} onChange={() => update("pendingReportReminders", !values.pendingReportReminders)} /></div>{values.pendingReportReminders && <label className="block text-sm font-semibold">Reminder after<select value={values.reminderMinutes} onChange={(event) => update("reminderMinutes", Number(event.target.value) as AdminSettingsValues["reminderMinutes"])} className={selectClass}><option value={30}>30 minutes</option><option value={60}>1 hour</option><option value={180}>3 hours</option><option value={360}>6 hours</option></select></label>}</div>}
        {tab === "notifications" && <div><h4 className="font-semibold">Notification Preferences</h4><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">These settings control future in-app notices. Existing notices remain available.</p><div className="mt-3"><SettingToggle title="New Report Alerts" detail="Notify administrators when a new flood report is submitted for review." checked={values.newReportAlerts} onChange={() => update("newReportAlerts", !values.newReportAlerts)} /><SettingToggle title="High-Severity Alerts" detail="Highlight new High or Critical citizen reports as unverified until reviewed." checked={values.highSeverityAlerts} onChange={() => update("highSeverityAlerts", !values.highSeverityAlerts)} /><SettingToggle title="Evacuation Center Updates" detail="Notify administrators when a center record is edited." checked={values.centerUpdateAlerts} onChange={() => update("centerUpdateAlerts", !values.centerUpdateAlerts)} /></div><p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Pending report reminders are configured under Flood Reports.</p></div>}
        {tab === "security" && <div className="space-y-5"><div><h4 className="font-semibold">Data Refresh</h4><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Overview and Live Operations Map refresh automatically every minute. Administrators can also refresh them manually.</p></div><div className="border-t border-[var(--color-border)] pt-5"><h4 className="font-semibold">Administrative Activity Logging</h4><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Administrative changes are recorded for review.</p><Link href="/admin/audit-logs" className="mt-3 inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--color-panel)]">View Audit Logs <ExternalLink className="h-4 w-4" /></Link></div><div className="border-t border-[var(--color-border)] pt-5"><h4 className="font-semibold">Enforced Safeguards</h4><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Administrator access is protected. Flood reports require review, and operations remain within Bulacan.</p></div></div>}
      </div>}
      {!loading && version && (tab === "reports" || tab === "notifications" || dirty) && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-border)] pt-4"><div className="text-sm">{error ? <span role="alert" className="text-[var(--color-danger)]">{error}</span> : success && !dirty ? <span role="status" className="inline-flex items-center gap-1 text-[var(--color-primary)]"><Check className="h-4 w-4" />Changes saved</span> : dirty ? <span className="text-[var(--color-muted-foreground)]">Unsaved changes</span> : null}</div><button type="button" onClick={() => void save()} disabled={!dirty || saving} className="h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button></div>}
      {error && (tab === "general" || tab === "security") && <p role="alert" className="text-sm text-[var(--color-danger)]">{error}</p>}
    </section>
  </div>;
}
