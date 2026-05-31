import dynamic from "next/dynamic";

import type { LegendItem, MapMarker, RiskPolygon, Theme } from "@/lib/types";

const DynamicFloodMap = dynamic(
  () => import("@/components/flood-map-client").then((mod) => mod.FloodMapClient),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-[var(--color-map-shell)] text-sm text-[var(--color-muted-foreground)]">
        Loading map...
      </div>
    ),
  },
);

type FloodMapProps = {
  theme: Theme;
  markers: MapMarker[];
  polygons: RiskPolygon[];
  legend: LegendItem[];
};

export function FloodMap(props: FloodMapProps) {
  return (
    <div className="h-full min-h-0 w-full">
      <DynamicFloodMap {...props} />
    </div>
  );
}
