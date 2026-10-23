"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { BULACAN_BOUNDARY_PATH_OPTIONS, BULACAN_BOUNDS, BULACAN_CENTER, BULACAN_MAP_MAX_BOUNDS, BULACAN_POLYGONS } from "@/lib/bulacan-scope";
import { compactBulacanPlace, isRecentMonitoringReport, isRecentOperationalReport, relativeOperationalTime } from "@/lib/admin-operations-policy";
import { centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";
import type { OperationsCenter, OperationsReport } from "@/lib/admin-operations-data";

function markerIcon(color: string, label: string, selected: boolean, center = false) {
  const radius = center ? "8px" : "50%";
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:28px;height:28px;border:${selected ? 3 : 2}px solid white;border-radius:${radius};background:${color};color:white;font:bold 12px sans-serif;box-shadow:0 2px 7px #0007">${label}</span>`,
    iconSize: [28, 28], iconAnchor: [14, 14],
  });
}

function reportColor(report: OperationsReport, asOf: number, recentReportWindowMs: number) {
  if (report.archivedAt || !isRecentMonitoringReport(report, asOf, recentReportWindowMs)) return "#64748b";
  if (report.verificationStatus !== "verified") return "#d97706";
  return report.severity === "Critical" || report.severity === "High" ? "#dc2626" : "#2563eb";
}

function MapController({ fitRequest }: { fitRequest: number }) {
  const map = useMap();
  useEffect(() => {
    let frame = 0;
    let initiallyFitted = false;
    const updateSize = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        map.invalidateSize({ pan: false });
        if (!initiallyFitted && map.getContainer().clientWidth && map.getContainer().clientHeight) {
          map.fitBounds(BULACAN_BOUNDS, { padding: [18, 18], maxZoom: 12 });
          initiallyFitted = true;
        }
      });
    };
    const observer = new ResizeObserver(updateSize);
    observer.observe(map.getContainer());
    updateSize();
    return () => { observer.disconnect(); window.cancelAnimationFrame(frame); };
  }, [map]);
  useEffect(() => {
    if (fitRequest > 0) {
      map.invalidateSize({ pan: false });
      map.fitBounds(BULACAN_BOUNDS, { padding: [18, 18], maxZoom: 12, animate: true });
    }
  }, [fitRequest, map]);
  return null;
}

function ReportMarker({ report, selected, asOf, recentReportWindowMs, onSelect }: { report: OperationsReport; selected: boolean; asOf: number; recentReportWindowMs: number; onSelect: () => void }) {
  const map = useMap();
  const marker = useRef<{ openPopup: () => void } | null>(null);
  const color = reportColor(report, asOf, recentReportWindowMs);
  const icon = useMemo(() => markerIcon(color, "R", selected), [color, selected]);
  useEffect(() => {
    if (!selected || !marker.current || report.latitude === null || report.longitude === null) return;
    map.flyTo([report.latitude, report.longitude], 14, { duration: 0.5 });
    const timer = window.setTimeout(() => marker.current?.openPopup(), 650);
    return () => window.clearTimeout(timer);
  }, [map, report.latitude, report.longitude, selected]);
  if (report.latitude === null || report.longitude === null) return null;
  const recent = isRecentOperationalReport(report, asOf, recentReportWindowMs);
  return <Marker ref={(instance: { openPopup: () => void } | null) => { marker.current = instance; }} position={[report.latitude, report.longitude]} icon={icon} title={report.title} eventHandlers={{ click: onSelect }}><Popup><div className="min-w-48 max-w-64 text-slate-900"><p className="text-xs font-semibold text-slate-500">{report.archivedAt ? "Archived flood report" : recent ? "Recent flood report" : "Historical flood report"}</p><p className="mt-1 font-semibold">{report.title}</p><p className="mt-1 text-xs text-slate-600">{compactBulacanPlace(report.locationName)}</p><p className="mt-2 text-xs">{report.severity} · {formatUiLabel(report.verificationStatus === "unreviewed" ? "pending_review" : report.verificationStatus)} · {formatUiLabel(report.status)}</p><p className="mt-1 text-xs text-slate-500"><time dateTime={report.createdAt} title={formatOperationalUpdate(report.createdAt)}>{relativeOperationalTime(report.createdAt, asOf)}</time></p><Link href={`/admin/reports/${report.id}`} className="mt-3 inline-block font-semibold text-blue-700">Review Report →</Link></div></Popup></Marker>;
}

function CenterMarker({ center, selected, asOf, onSelect }: { center: OperationsCenter; selected: boolean; asOf: number; onSelect: () => void }) {
  const map = useMap();
  const marker = useRef<{ openPopup: () => void } | null>(null);
  const color = center.openingStatus === "open" ? "#16a34a" : "#475569";
  const icon = useMemo(() => markerIcon(color, "C", selected, true), [color, selected]);
  useEffect(() => {
    if (!selected || !marker.current || center.latitude === null || center.longitude === null) return;
    map.flyTo([center.latitude, center.longitude], 14, { duration: 0.5 });
    const timer = window.setTimeout(() => marker.current?.openPopup(), 650);
    return () => window.clearTimeout(timer);
  }, [map, center.latitude, center.longitude, selected]);
  if (center.latitude === null || center.longitude === null) return null;
  return <Marker ref={(instance: { openPopup: () => void } | null) => { marker.current = instance; }} position={[center.latitude, center.longitude]} icon={icon} title={center.name} eventHandlers={{ click: onSelect }}><Popup><div className="min-w-48 max-w-64 text-slate-900"><p className="text-xs font-semibold text-slate-500">Evacuation center</p><p className="mt-1 font-semibold">{center.name}</p><p className="mt-1 text-xs text-slate-600">{center.barangay ? `${center.barangay}, ` : ""}{center.city}, Bulacan</p><p className="mt-2 text-xs">{center.openingStatus === "unknown" ? "Opening unconfirmed" : centerOpeningLabel(center)} · {formatUiLabel(center.verificationStatus)}</p>{center.estimatedCapacity !== null ? <p className="mt-1 text-xs">Estimated capacity: {center.estimatedCapacity}</p> : null}<p className="mt-1 text-xs text-slate-500">Updated {relativeOperationalTime(center.updatedAt, asOf)}</p><Link href={`/admin/data/${center.id}`} className="mt-3 inline-block font-semibold text-blue-700">View Center →</Link></div></Popup></Marker>;
}

export function AdminOperationsMapLeaflet({ reports, centers, selectedId, onSelectId, asOf, recentReportWindowMs }: { reports: OperationsReport[]; centers: OperationsCenter[]; selectedId?: string | null; onSelectId?: (id: string) => void; asOf: number; recentReportWindowMs: number }) {
  const [fitRequest, setFitRequest] = useState(0);
  const [tileFailed, setTileFailed] = useState(false);
  const [localSelectedId, setLocalSelectedId] = useState<string | null>(null);
  const activeSelection = selectedId === undefined ? localSelectedId : selectedId;
  const selectMarker = (id: string) => { setLocalSelectedId(id); onSelectId?.(id); };
  const hasHistorical = reports.some((report) => Boolean(report.archivedAt) || !isRecentMonitoringReport(report, asOf, recentReportWindowMs));
  const hasPending = reports.some((report) => !report.archivedAt && isRecentMonitoringReport(report, asOf, recentReportWindowMs) && report.verificationStatus === "unreviewed");
  const hasVerifiedHigh = reports.some((report) => !report.archivedAt && isRecentMonitoringReport(report, asOf, recentReportWindowMs) && report.verificationStatus === "verified" && ["High", "Critical"].includes(report.severity));
  const hasVerified = reports.some((report) => !report.archivedAt && isRecentMonitoringReport(report, asOf, recentReportWindowMs) && report.verificationStatus === "verified" && !["High", "Critical"].includes(report.severity));
  const hasOpenCenter = centers.some((center) => center.openingStatus === "open");
  const hasOtherCenter = centers.some((center) => center.openingStatus !== "open");
  return <div className="flex h-full min-h-0 w-full flex-col">
    <div className="relative min-h-0 flex-1">
      <MapContainer center={BULACAN_CENTER} zoom={10} minZoom={8} maxZoom={19} maxBounds={BULACAN_MAP_MAX_BOUNDS} maxBoundsViscosity={1} className="h-full w-full" attributionControl zoomControl preferCanvas>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
        <MapController fitRequest={fitRequest} />
        <Polygon positions={BULACAN_POLYGONS as [number, number][][][]} interactive={false} pathOptions={BULACAN_BOUNDARY_PATH_OPTIONS} />
        <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={55} disableClusteringAtZoom={14} iconCreateFunction={(cluster: { getChildCount: () => number }) => L.divIcon({ className: "", html: `<span role="img" aria-label="${cluster.getChildCount()} grouped map records" style="display:grid;place-items:center;width:36px;height:36px;border:2px solid white;border-radius:50%;background:#2563eb;color:white;font:bold 12px sans-serif;box-shadow:0 3px 9px #0007">${cluster.getChildCount()}</span>`, iconSize: [36, 36], iconAnchor: [18, 18] })}>
          {reports.map((report) => <ReportMarker key={report.id} report={report} selected={activeSelection === `report:${report.id}`} asOf={asOf} recentReportWindowMs={recentReportWindowMs} onSelect={() => selectMarker(`report:${report.id}`)} />)}
          {centers.map((center) => <CenterMarker key={center.id} center={center} selected={activeSelection === `center:${center.id}`} asOf={asOf} onSelect={() => selectMarker(`center:${center.id}`)} />)}
        </MarkerClusterGroup>
      </MapContainer>
      <button type="button" onClick={() => setFitRequest((value) => value + 1)} className="absolute right-3 top-3 z-[500] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow">Fit to Bulacan</button>
      {tileFailed ? <p role="status" className="absolute bottom-8 left-3 z-[500] rounded-lg bg-white px-3 py-2 text-xs text-slate-900 shadow">Map tiles could not load. Records remain available in the list.</p> : null}
    </div>
    <div className="flex min-h-8 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-1.5 text-[11px] text-[var(--color-muted-foreground)]">
      {hasPending ? <span><span className="text-amber-600">●</span> Pending review</span> : null}
      {hasVerifiedHigh ? <span><span className="text-red-600">●</span> Verified high</span> : null}
      {hasVerified ? <span><span className="text-blue-600">●</span> Verified report</span> : null}
      {hasHistorical ? <span><span className="text-slate-500">●</span> Historical or inactive report</span> : null}
      {hasOpenCenter ? <span><span className="text-green-600">■</span> Confirmed open center</span> : null}
      {hasOtherCenter ? <span><span className="text-slate-500">■</span> Other center</span> : null}
      {!reports.length && !centers.length ? <span>No mapped records for these filters</span> : null}
    </div>
  </div>;
}
