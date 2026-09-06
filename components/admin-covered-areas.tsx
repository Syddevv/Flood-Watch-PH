"use client";
import { useEffect, useMemo, useState } from "react";

type Risk = "Critical" | "High" | "Moderate" | "Low";
type Area = { barangay: string; risk: Risk; waterLevel: number; monitoring: "Active" | "Paused" };
type Report = { locationName: string; publicStatus: string };

const areas: Area[] = [
  { barangay: "Balite", risk: "Critical", waterLevel: 1.8, monitoring: "Active" },
  { barangay: "Calizon", risk: "Critical", waterLevel: 1.7, monitoring: "Active" },
  { barangay: "Calumpang", risk: "High", waterLevel: 1.5, monitoring: "Active" },
  { barangay: "Caniogan", risk: "High", waterLevel: 1.4, monitoring: "Active" },
  { barangay: "Corazon", risk: "High", waterLevel: 1.2, monitoring: "Active" },
  { barangay: "Frances", risk: "Moderate", waterLevel: 1.1, monitoring: "Active" },
  { barangay: "Gatbuca", risk: "Moderate", waterLevel: 0.9, monitoring: "Active" },
  { barangay: "Gugo", risk: "Moderate", waterLevel: 0.8, monitoring: "Active" },
  { barangay: "Iba Este", risk: "Low", waterLevel: 0.6, monitoring: "Paused" },
  { barangay: "Iba O'Este", risk: "Low", waterLevel: 0.5, monitoring: "Active" },
];

const riskClass: Record<Risk, string> = { Critical: "bg-red-400/80 text-white", High: "bg-slate-600 text-white", Moderate: "bg-slate-600 text-white", Low: "bg-slate-700 text-slate-100" };

export function AdminCoveredAreas() {
  const [reports, setReports] = useState<Report[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void fetch("/api/admin/reports?page=1&limit=50", { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Unable to load report coverage."); setReports(body.data.reports); }).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load report coverage.")); }, []);
  const reportCounts = useMemo(() => Object.fromEntries(areas.map((area) => [area.barangay, reports.filter((report) => report.locationName.toLowerCase().includes(area.barangay.toLowerCase()) && !["Resolved", "Archived"].includes(report.publicStatus)).length])), [reports]);
  return <div className="space-y-6"><header><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Covered areas</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Monitor barangay-level risk, report volume, water levels, and active coverage.</p></header><p className="text-xs text-[var(--color-muted-foreground)]"><span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--color-warning)]" />Water levels, risk ratings, and monitoring state are operational preview data. Active report counts use current report records.</p>{error && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-400">{error}</p>}<section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b border-[var(--color-border)]"><tr>{["Barangay", "Current risk", "Water level", "Active reports", "Monitoring"].map((heading) => <th key={heading} className="px-5 py-5 font-semibold">{heading}</th>)}</tr></thead><tbody>{areas.map((area) => <tr key={area.barangay} className="border-b border-[var(--color-border)] last:border-0"><td className="px-5 py-3 font-semibold">{area.barangay}</td><td className="px-5 py-3"><span className={`rounded-md px-2 py-1 text-xs font-semibold ${riskClass[area.risk]}`}>{area.risk}</span></td><td className="px-5 py-3 font-semibold tabular-nums">{area.waterLevel.toFixed(1)} m</td><td className="px-5 py-3 font-semibold tabular-nums">{reportCounts[area.barangay] ?? 0}</td><td className="px-5 py-3"><span className="rounded-lg border border-[var(--color-border)] px-2 py-1 text-xs font-semibold">{area.monitoring}</span></td></tr>)}</tbody></table></div></section></div>;
}
