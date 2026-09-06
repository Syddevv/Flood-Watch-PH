"use client";

import Link from "next/link";
import { Download, Eye, Filter, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";

type RescueStatus = "critical" | "urgent" | "assigned";
type RescueRequest = {
  id: string;
  priority: "Critical" | "High";
  status: RescueStatus;
  title: string;
  description: string;
  location: string;
  assignee: string;
  updated: string;
};

const requests: RescueRequest[] = [
  { id: "RR-1048", priority: "Critical", status: "critical", title: "Family trapped on second floor", description: "Five people, including one infant and one senior citizen. Water continues to rise.", location: "Brgy. Meysulao", assignee: "Team Alpha", updated: "2 min ago" },
  { id: "RR-1045", priority: "High", status: "urgent", title: "Dialysis patient needs transport", description: "Patient needs transfer to Bulacan Medical Center before 22:00.", location: "Brgy. Longos", assignee: "Unassigned", updated: "9 min ago" },
];

const priorityClass = { Critical: "bg-red-400/80 text-white", High: "bg-slate-600 text-white" } as const;
const statusClass = { critical: "border border-red-500/40 bg-red-500/10 text-red-300", urgent: "border border-amber-500/40 bg-amber-500/10 text-amber-300", assigned: "border border-blue-500/40 bg-blue-500/10 text-blue-300" } as const;

export function AdminRescueRequests() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const filtered = useMemo(() => requests.filter((request) => {
    const matchesSearch = `${request.id} ${request.title} ${request.location} ${request.assignee}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (!status || request.status === status);
  }), [search, status]);

  return <div className="space-y-6"><header className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p><h2 className="mt-2 text-3xl font-bold tracking-tight">Rescue requests</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Prioritize life-safety needs, assign response teams, and track outcomes.</p></div><div className="flex gap-2"><button type="button" className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 text-sm font-semibold hover:bg-[var(--color-panel)]"><Download className="h-4 w-4" />Export</button><Link href="/admin/rescue-requests/new" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New rescue</Link></div></header><div className="grid gap-3 md:grid-cols-3"><Summary label="Total active" value="2" /><Summary label="Critical priority" value="1" /><Summary label="Assigned" value="1" /></div><section className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"><div className="flex flex-wrap gap-3 p-5"><label className="flex min-w-[240px] flex-1 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3"><Search className="h-4 w-4 text-[var(--color-muted-foreground)]" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search rescue requests..." className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></label><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 py-2 text-sm"><option value="">All statuses</option><option value="critical">Critical</option><option value="urgent">Urgent</option><option value="assigned">Assigned</option></select><button type="button" className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-semibold hover:bg-[var(--color-panel)]"><Filter className="h-4 w-4" />More filters</button></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="border-b border-[var(--color-border)] text-xs text-[var(--color-muted-foreground)]"><tr>{["ID", "Priority / status", "Summary", "Location", "Assignee", "Updated", "Action"].map((heading) => <th key={heading} className="px-5 py-4 font-semibold">{heading}</th>)}</tr></thead><tbody>{filtered.map((request) => <tr key={request.id} className="border-b border-[var(--color-border)] last:border-0"><td className="px-5 py-4 font-mono text-xs font-semibold">{request.id}</td><td className="space-y-1 px-5 py-4"><span className={`block w-fit rounded-md px-2 py-1 text-[11px] font-semibold ${priorityClass[request.priority]}`}>{request.priority}</span><span className={`block w-fit rounded-md px-2 py-1 text-[11px] font-semibold capitalize ${statusClass[request.status]}`}>{request.status}</span></td><td className="max-w-[510px] px-5 py-4"><p className="font-semibold">{request.title}</p><p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{request.description}</p></td><td className="px-5 py-4 font-medium">{request.location}</td><td className="px-5 py-4">{request.assignee}</td><td className="whitespace-nowrap px-5 py-4">{request.updated}</td><td className="px-5 py-4"><button type="button" aria-label={`Open ${request.id}`} className="rounded-md p-2 hover:bg-[var(--color-panel)]"><Eye className="h-4 w-4" /></button></td></tr>)}</tbody></table></div>{filtered.length === 0 && <p className="border-t border-[var(--color-border)] p-8 text-center text-sm text-[var(--color-muted-foreground)]">No rescue requests match the current filters.</p>}<footer className="flex items-center justify-between border-t border-[var(--color-border)] px-5 py-4 text-xs text-[var(--color-muted-foreground)]"><span>Showing {filtered.length} operational records</span><div className="flex gap-2"><button type="button" disabled className="rounded-lg border border-[var(--color-border)] px-3 py-2 opacity-40">Previous</button><button type="button" disabled className="rounded-lg border border-[var(--color-border)] px-3 py-2 opacity-40">Next</button></div></footer></section><p className="text-xs text-[var(--color-muted-foreground)]">Operational preview data. Rescue request persistence will be connected when its backend model is introduced.</p></div>;
}

function Summary({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><p className="text-sm text-[var(--color-muted-foreground)]">{label}</p><p className="mt-2 text-lg font-bold tabular-nums">{value}</p></div>;
}
