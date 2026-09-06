"use client";

import { Check } from "lucide-react";
import { useState } from "react";

type SettingsTab = "general" | "notifications";
type NotificationSetting = "criticalRescue" | "verificationReminders" | "capacityWarnings";

const notificationOptions: Array<{ key: NotificationSetting; label: string; detail: string }> = [
  {
    key: "criticalRescue",
    label: "Critical rescue alerts",
    detail: "Enabled for Municipal DRRMO administrators.",
  },
  {
    key: "verificationReminders",
    label: "Report verification reminders",
    detail: "Enabled for Municipal DRRMO administrators.",
  },
  {
    key: "capacityWarnings",
    label: "Evacuation capacity warnings",
    detail: "Enabled for Municipal DRRMO administrators.",
  },
];

function SettingsSwitch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={onChange} className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${checked ? "bg-[var(--color-primary)]" : "bg-slate-500/70"}`}>
      <span className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${checked ? "translate-x-3.5" : "translate-x-0"}`} />
    </button>
  );
}

function SaveButton({ saved, onClick }: { saved: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white hover:brightness-110">
      {saved && <Check className="h-4 w-4" />}
      {saved ? "Saved" : "Save changes"}
    </button>
  );
}

export function AdminSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [operationsCenter, setOperationsCenter] = useState("Calumpit Municipal Emergency Operations Center");
  const [advisoryFooter, setAdvisoryFooter] = useState("Follow official PAGASA and Calumpit MDRRMO advisories.");
  const [notificationSettings, setNotificationSettings] = useState<Record<NotificationSetting, boolean>>({
    criticalRescue: true,
    verificationReminders: true,
    capacityWarnings: true,
  });
  const [savedTab, setSavedTab] = useState<SettingsTab | null>(null);

  function selectTab(tab: SettingsTab) {
    setActiveTab(tab);
  }

  function updateNotification(key: NotificationSetting) {
    setNotificationSettings((current) => ({ ...current, [key]: !current[key] }));
    setSavedTab(null);
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <header className="border-b border-[var(--color-border)] pb-5">
        <p className="text-xs font-bold tracking-[.14em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p>
        <h2 className="mt-1 text-3xl font-bold">Administration settings</h2>
        <p className="mt-1 text-sm text-blue-300">Controlled prototype settings for operations identity and alert routing.</p>
      </header>

      <div className="mx-auto mt-6 max-w-[976px]">
        <div className="grid grid-cols-2 rounded-xl bg-[var(--color-surface)] p-1">
          <button type="button" onClick={() => selectTab("general")} className={`h-8 rounded-lg text-sm font-semibold transition ${activeTab === "general" ? "border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-foreground)]" : "text-blue-300 hover:text-[var(--color-foreground)]"}`}>General</button>
          <button type="button" onClick={() => selectTab("notifications")} className={`h-8 rounded-lg text-sm font-semibold transition ${activeTab === "notifications" ? "border border-[var(--color-border)] bg-[var(--color-panel)] text-[var(--color-foreground)]" : "text-blue-300 hover:text-[var(--color-foreground)]"}`}>Notifications</button>
        </div>

        {activeTab === "general" && (
          <section className="mt-6 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold">Operations identity</h3>
            <p className="mt-1 text-sm text-blue-300">Municipal command-center information shown to operators.</p>

            <div className="mt-7 space-y-5">
              <label className="block">
                <span className="text-sm font-semibold">Operations center name</span>
                <input value={operationsCenter} onChange={(event) => { setOperationsCenter(event.target.value); setSavedTab(null); }} className="mt-2 h-10 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]" />
              </label>
              <label className="block">
                <span className="text-sm font-semibold">Public advisory footer</span>
                <textarea value={advisoryFooter} onChange={(event) => { setAdvisoryFooter(event.target.value); setSavedTab(null); }} rows={3} className="mt-2 w-full resize-y rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-3 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]" />
              </label>
            </div>

            <div className="mt-5 flex justify-end">
              <SaveButton saved={savedTab === "general"} onClick={() => setSavedTab("general")} />
            </div>
          </section>
        )}

        {activeTab === "notifications" && (
          <section className="mt-6 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold">Alert routing</h3>
            <p className="mt-1 text-sm text-blue-300">Choose which critical updates interrupt the operations team.</p>

            <div className="mt-7 space-y-6">
              {notificationOptions.map((option) => (
                <div key={option.key} className="flex items-center justify-between gap-5">
                  <div>
                    <h4 className="font-semibold">{option.label}</h4>
                    <p className="mt-0.5 text-sm text-blue-300">{option.detail}</p>
                  </div>
                  <SettingsSwitch checked={notificationSettings[option.key]} onChange={() => updateNotification(option.key)} label={option.label} />
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end">
              <SaveButton saved={savedTab === "notifications"} onClick={() => setSavedTab("notifications")} />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
