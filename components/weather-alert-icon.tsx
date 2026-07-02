import {
  AlertTriangle,
  CloudRain,
  Droplets,
  ShieldAlert,
  type LucideProps,
} from "lucide-react";

import type { FloodAlert } from "@/lib/types";

type WeatherAlertIconProps = LucideProps & {
  alert: FloodAlert;
};

export function WeatherAlertIcon({ alert, ...props }: WeatherAlertIconProps) {
  const text = `${alert.title} ${alert.riskLevel}`.toLowerCase();

  if (text.includes("rain") || text.includes("precipitation")) {
    return <CloudRain {...props} />;
  }

  if (text.includes("flood") || text.includes("water")) {
    return <Droplets {...props} />;
  }

  if (alert.severity === "severe" || alert.severity === "high") {
    return <ShieldAlert {...props} />;
  }

  return <AlertTriangle {...props} />;
}
