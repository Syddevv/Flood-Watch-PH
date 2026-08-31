"use client";

import { ChevronDown, Download } from "lucide-react";
import { useMemo, useState } from "react";

type RangeKey = "24h" | "7d" | "30d";
type VolumePoint = { label: string; reports: number; rescues: number; incidents: number };

const rangeLabels: Record<RangeKey, string> = {
  "24h": "Last 24 hours",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
};

const volumeByRange: Record<RangeKey, VolumePoint[]> = {
  "24h": [
    { label: "14:00", reports: 8, rescues: 1, incidents: 0 },
    { label: "15:00", reports: 14, rescues: 2, incidents: 1 },
    { label: "16:00", reports: 21, rescues: 4, incidents: 3 },
    { label: "17:00", reports: 38, rescues: 6, incidents: 6 },
    { label: "18:00", reports: 52, rescues: 9, incidents: 8 },
    { label: "19:00", reports: 67, rescues: 13, incidents: 10 },
    { label: "20:00", reports: 82, rescues: 18, incidents: 12 },
  ],
  "7d": [
    { label: "Mon", reports: 38, rescues: 6, incidents: 4 },
    { label: "Tue", reports: 46, rescues: 8, incidents: 6 },
    { label: "Wed", reports: 42, rescues: 7, incidents: 5 },
    { label: "Thu", reports: 61, rescues: 12, incidents: 8 },
    { label: "Fri", reports: 74, rescues: 16, incidents: 11 },
    { label: "Sat", reports: 68, rescues: 14, incidents: 9 },
    { label: "Sun", reports: 82, rescues: 18, incidents: 12 },
  ],
  "30d": [
    { label: "Week 1", reports: 44, rescues: 8, incidents: 5 },
    { label: "Week 2", reports: 57, rescues: 11, incidents: 7 },
    { label: "Week 3", reports: 69, rescues: 15, incidents: 10 },
    { label: "Week 4", reports: 82, rescues: 18, incidents: 12 },
  ],
};

const barangays = [
  { label: "Balite", value: 18 },
  { label: "Calizon", value: 16 },
  { label: "Calumpang", value: 14 },
  { label: "Caniogan", value: 12 },
  { label: "Corazon", value: 10 },
  { label: "Frances", value: 8 },
  { label: "Gatbuca", value: 6 },
  { label: "Gugo", value: 4 },
  { label: "Iba Este", value: 2 },
  { label: "Iba O'Este", value: 2 },
];

const severity = [
  { label: "Severe", value: 3, color: "#3b82f6" },
  { label: "High", value: 7, color: "#f87171" },
  { label: "Moderate", value: 8, color: "#fbbf24" },
  { label: "Low", value: 7, color: "#4ade80" },
];

const metrics = [
  { label: "Critical rescues", value: "3", detail: "+1 in 10 min", critical: true },
  { label: "Active incidents", value: "12", detail: "4 severe" },
  { label: "Awaiting verification", value: "19", detail: "Oldest: 26 min" },
  { label: "People sheltered", value: "918", detail: "80% total capacity" },
];

function linePath(points: VolumePoint[], key: "reports" | "rescues" | "incidents") {
  return points.map((point, index) => {
    const x = 54 + (index / Math.max(points.length - 1, 1)) * 726;
    const y = 252 - (point[key] / 100) * 224;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function OperationalVolume({ points }: { points: VolumePoint[] }) {
  const reportLine = linePath(points, "reports");
  const reportArea = `${reportLine} L780,252 L54,252 Z`;
  return (
    <svg viewBox="0 0 820 290" className="mt-5 h-auto w-full overflow-visible" role="img" aria-label="Operational reports, rescues, and incidents over time">
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = 252 - (tick / 100) * 224;
        return <g key={tick}><line x1="54" x2="780" y1={y} y2={y} stroke="var(--color-border)" strokeWidth="1" /><text x="46" y={y + 4} textAnchor="end" fill="#93c5fd" fontSize="11">{tick}</text></g>;
      })}
      <line x1="54" x2="54" y1="28" y2="252" stroke="#64748b" />
      <line x1="54" x2="780" y1="252" y2="252" stroke="#64748b" />
      <path d={reportArea} fill="#3b82f6" opacity="0.16" />
      <path d={reportLine} fill="none" stroke="#3b82f6" strokeWidth="1.2" />
      <path d={linePath(points, "rescues")} fill="none" stroke="#f87171" strokeWidth="1.2" />
      <path d={linePath(points, "incidents")} fill="none" stroke="#fbbf24" strokeWidth="1.2" />
      {points.map((point, index) => {
        const x = 54 + (index / Math.max(points.length - 1, 1)) * 726;
        return <text key={point.label} x={x} y="270" textAnchor="middle" fill="#93c5fd" fontSize="11">{point.label}</text>;
      })}
    </svg>
  );
}

function SeverityDonut() {
  const total = severity.reduce((sum, item) => sum + item.value, 0);
  return (
    <div className="flex min-h-[286px] items-center justify-center">
      <svg viewBox="0 0 220 220" className="h-48 w-48" role="img" aria-label="Severity mix of current active records">
        <circle cx="110" cy="110" r="64" fill="none" stroke="var(--color-panel)" strokeWidth="36" />
        {severity.map((item, index) => {
          const length = (item.value / total) * 100;
          const offset = severity.slice(0, index).reduce((sum, segment) => sum + (segment.value / total) * 100, 0);
          return <circle key={item.label} cx="110" cy="110" r="64" fill="none" stroke={item.color} strokeWidth="36" pathLength="100" strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-offset} transform="rotate(-90 110 110)"><title>{item.label}: {item.value}</title></circle>;
        })}
      </svg>
    </div>
  );
}

function BarangayChart() {
  const [hovered, setHovered] = useState<number | null>(1);
  return (
    <div className="relative mt-5 min-w-[720px]">
      <svg viewBox="0 0 960 270" className="h-auto w-full" role="img" aria-label="Flood reports by barangay">
        {[0, 5, 10, 15, 20].map((tick) => {
          const y = 224 - (tick / 20) * 190;
          return <g key={tick}><line x1="46" x2="940" y1={y} y2={y} stroke="var(--color-border)" /><text x="39" y={y + 4} textAnchor="end" fill="#93c5fd" fontSize="11">{tick}</text></g>;
        })}
        <line x1="46" x2="46" y1="34" y2="224" stroke="#64748b" />
        <line x1="46" x2="940" y1="224" y2="224" stroke="#64748b" />
        {barangays.map((item, index) => {
          const slot = 89;
          const x = 56 + index * slot;
          const height = (item.value / 20) * 190;
          return <g key={item.label} onMouseEnter={() => setHovered(index)} onMouseLeave={() => setHovered(null)} className="cursor-default"><rect x={x} y={224 - height} width="70" height={height} rx="3" fill="#3b82f6" opacity={hovered === null || hovered === index ? 1 : 0.68} /><text x={x + 35} y="243" textAnchor="middle" fill="#93c5fd" fontSize="10">{item.label}</text></g>;
        })}
      </svg>
      {hovered !== null && <div className="pointer-events-none absolute rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white shadow-xl" style={{ left: `${Math.min(84, 8 + hovered * 9.1)}%`, top: `${44 - barangays[hovered].value}%`, transform: "translateX(-50%)" }}><div className="font-semibold">{barangays[hovered].label}</div><div className="mt-1 flex min-w-24 items-center justify-between gap-5 text-slate-300"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-blue-500" />Reports</span><strong className="text-white">{barangays[hovered].value}</strong></div></div>}
    </div>
  );
}

function downloadCsv(range: RangeKey, points: VolumePoint[]) {
  const rows = ["period,reports,rescues,incidents", ...points.map((point) => `${point.label},${point.reports},${point.rescues},${point.incidents}`), "", "barangay,reports", ...barangays.map((item) => `\"${item.label}\",${item.value}`)];
  const url = URL.createObjectURL(new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `floodwatch-analytics-${range}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>("24h");
  const points = useMemo(() => volumeByRange[range], [range]);
  return (
    <div className="space-y-4 sm:space-y-5">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[.14em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p>
          <h2 className="mt-1 text-2xl font-bold sm:text-3xl">Operational analytics</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Analyze report patterns, response load, affected areas, and evacuation utilization.</p>
        </div>
        <div className="flex gap-2">
          <label className="relative flex-1 sm:flex-none">
            <span className="sr-only">Analytics time range</span>
            <select value={range} onChange={(event) => setRange(event.target.value as RangeKey)} className="floodwatch-form-select h-10 w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-3 pr-9 text-sm font-semibold outline-none sm:w-36">
              {Object.entries(rangeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[var(--color-muted-foreground)]" />
          </label>
          <button type="button" onClick={() => downloadCsv(range, points)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold hover:bg-[var(--color-panel)]"><Download className="h-4 w-4" />Export</button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => <section key={metric.label} className={`flex min-h-40 flex-col rounded-[14px] border bg-[var(--color-surface)] p-6 ${metric.critical ? "border-red-400/50" : "border-[var(--color-border)]"}`}><p className="text-sm text-blue-300">{metric.label}</p><p className="mt-2 text-3xl font-bold tabular-nums">{metric.value}</p><p className="mt-auto pt-5 text-xs text-blue-300">{metric.detail}</p></section>)}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(330px,1fr)]">
        <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"><h3 className="font-semibold">Operational volume</h3><p className="mt-1 text-sm text-blue-300">Reports, rescues, and incidents by hour.</p><OperationalVolume points={points} /></section>
        <section className="rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"><h3 className="font-semibold">Severity mix</h3><p className="mt-1 text-sm text-blue-300">Current active records.</p><SeverityDonut /></section>
      </div>

      <section className="overflow-hidden rounded-[14px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 sm:p-6"><h3 className="font-semibold">Reports by barangay</h3><div className="overflow-x-auto"><BarangayChart /></div></section>
    </div>
  );
}
