"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.Default.css";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MapContainer, Marker, Polygon, Popup, TileLayer, useMap } from "react-leaflet";
import { BULACAN_BOUNDARY_PATH_OPTIONS, BULACAN_BOUNDS, BULACAN_HOLE_MASKS, BULACAN_MAP_MAX_BOUNDS, BULACAN_MASK_PATH_OPTIONS, BULACAN_OUTSIDE_MASK, BULACAN_POLYGONS } from "@/lib/bulacan-scope";
import { centerOpeningLabel, formatOperationalUpdate } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";
import type { OperationsCenter, OperationsReport } from "@/lib/admin-operations-data";

function icon(color: string, label: string) {
  return L.divIcon({
    className: "",
    html: `<span style="display:grid;place-items:center;width:32px;height:32px;border:2px solid white;border-radius:50%;background:${color};color:white;font:bold 13px sans-serif;box-shadow:0 2px 8px #0008">${label}</span>`,
    iconSize: [32, 32], iconAnchor: [16, 16],
  });
}

function reportColor(report: OperationsReport) {
  if (report.verificationStatus === "rejected") return "#64748b";
  if (report.verificationStatus !== "verified") return "#f59e0b";
  return report.severity === "Critical" || report.severity === "High" ? "#ef4444" : "#2563eb";
}

function MapController({ fitRequest }: { fitRequest: number }) {
  const map = useMap();
  useEffect(() => { if (fitRequest > 0) map.fitBounds(BULACAN_BOUNDS, { padding: [24, 24] }); }, [fitRequest, map]);
  return null;
}

function ReportMarker({ report, selected }: { report: OperationsReport; selected: boolean }) {
  const map = useMap();
  const marker = useRef<{ openPopup: () => void } | null>(null);
  const markerIcon = useMemo(() => icon(reportColor(report), "R"), [report]);
  useEffect(() => {
    if (!selected || !marker.current) return;
    map.flyTo([report.latitude!, report.longitude!], 14, { duration: 0.5 });
    const timer = window.setTimeout(() => marker.current?.openPopup(), 650);
    return () => window.clearTimeout(timer);
  }, [map, report.latitude, report.longitude, selected]);
  if (report.latitude === null || report.longitude === null) return null;
  return <Marker ref={(instance: { openPopup: () => void } | null) => { marker.current = instance; }} position={[report.latitude, report.longitude]} icon={markerIcon} title={report.title}><Popup><div className="min-w-48 text-slate-900"><p className="text-xs text-slate-500">Flood report #{report.id.slice(0, 8)}</p><p className="mt-1 font-semibold">{report.title}</p><p className="mt-1 text-sm">{report.locationName}</p><p className="mt-1 text-xs">{report.severity} · {formatUiLabel(report.verificationStatus)} · {formatUiLabel(report.status)}</p><p className="mt-1 text-xs">{formatOperationalUpdate(report.createdAt)}</p><p className="mt-2 line-clamp-3 text-xs">{report.description}</p><Link href={`/admin/reports/${report.id}`} className="mt-3 inline-block font-semibold text-blue-700">Review Report →</Link></div></Popup></Marker>;
}

function CenterMarker({ center, selected }: { center: OperationsCenter; selected: boolean }) {
  const map = useMap();
  const marker = useRef<{ openPopup: () => void } | null>(null);
  const markerIcon = useMemo(() => icon(center.openingStatus === "open" ? "#16a34a" : "#64748b", "C"), [center.openingStatus]);
  useEffect(() => {
    if (!selected || !marker.current) return;
    map.flyTo([center.latitude!, center.longitude!], 14, { duration: 0.5 });
    const timer = window.setTimeout(() => marker.current?.openPopup(), 650);
    return () => window.clearTimeout(timer);
  }, [map, center.latitude, center.longitude, selected]);
  if (center.latitude === null || center.longitude === null) return null;
  return <Marker ref={(instance: { openPopup: () => void } | null) => { marker.current = instance; }} position={[center.latitude, center.longitude]} icon={markerIcon} title={center.name}><Popup><div className="min-w-48 text-slate-900"><p className="text-xs text-slate-500">Evacuation center</p><p className="mt-1 font-semibold">{center.name}</p><p className="mt-1 text-sm">{center.address}{center.barangay ? `, ${center.barangay}` : ""}, {center.city}, Bulacan</p><p className="mt-1 text-xs">{centerOpeningLabel(center)} · {formatUiLabel(center.verificationStatus)}</p><p className="mt-1 text-xs">Estimated capacity: {center.estimatedCapacity ?? "unavailable"}</p><Link href={`/admin/data/${center.id}`} className="mt-3 inline-block font-semibold text-blue-700">View Center →</Link></div></Popup></Marker>;
}

export function AdminOperationsMapLeaflet({ reports, centers, selectedId }: { reports: OperationsReport[]; centers: OperationsCenter[]; selectedId?: string | null }) {
  const [fitRequest, setFitRequest] = useState(0);
  const [tileFailed, setTileFailed] = useState(false);
  return <div className="relative h-full w-full">
    <MapContainer bounds={BULACAN_BOUNDS} boundsOptions={{ padding: [24, 24] }} minZoom={8} maxZoom={19} maxBounds={BULACAN_MAP_MAX_BOUNDS} maxBoundsViscosity={1} className="h-full w-full" attributionControl zoomControl preferCanvas>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" eventHandlers={{ tileerror: () => setTileFailed(true), tileload: () => setTileFailed(false) }} />
      <MapController fitRequest={fitRequest} />
      <Polygon positions={BULACAN_OUTSIDE_MASK as [number, number][][]} interactive={false} pathOptions={BULACAN_MASK_PATH_OPTIONS} />
      {BULACAN_HOLE_MASKS.map((ring, index) => <Polygon key={index} positions={ring} interactive={false} pathOptions={BULACAN_MASK_PATH_OPTIONS} />)}
      <Polygon positions={BULACAN_POLYGONS as [number, number][][][]} interactive={false} pathOptions={BULACAN_BOUNDARY_PATH_OPTIONS} />
      <MarkerClusterGroup chunkedLoading showCoverageOnHover={false} maxClusterRadius={60} disableClusteringAtZoom={14}>
        {reports.map((report) => <ReportMarker key={report.id} report={report} selected={selectedId === `report:${report.id}`} />)}
        {centers.map((center) => <CenterMarker key={center.id} center={center} selected={selectedId === `center:${center.id}`} />)}
      </MarkerClusterGroup>
    </MapContainer>
    <button type="button" onClick={() => setFitRequest((value) => value + 1)} className="absolute right-3 top-3 z-[500] rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow">Fit to Bulacan</button>
    {tileFailed ? <p role="status" className="absolute bottom-3 left-3 z-[500] rounded-lg bg-white px-3 py-2 text-xs text-slate-900 shadow">Map tiles could not load. Records remain available in the list.</p> : null}
    <div className="absolute bottom-3 right-3 z-[500] rounded-lg bg-white/95 px-3 py-2 text-xs text-slate-900 shadow"><span className="text-amber-600">●</span> Unreviewed · <span className="text-red-600">●</span> Verified high · <span className="text-blue-600">●</span> Verified · <span className="text-green-600">●</span> Open center · <span className="text-slate-600">●</span> Other center</div>
  </div>;
}
