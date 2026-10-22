"use client";

import dynamic from "next/dynamic";
import type { OperationsCenter, OperationsReport } from "@/lib/admin-operations-data";

const Map = dynamic(() => import("@/components/admin-operations-map-leaflet").then((module) => module.AdminOperationsMapLeaflet), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[var(--color-muted-foreground)]">Loading Bulacan map…</div>,
});

export function AdminOperationsMap({ reports, centers, selectedId, onSelectId, asOf }: { reports: OperationsReport[]; centers: OperationsCenter[]; selectedId?: string | null; onSelectId?: (id: string) => void; asOf: number }) {
  return <Map reports={reports} centers={centers} selectedId={selectedId} onSelectId={onSelectId} asOf={asOf} />;
}
