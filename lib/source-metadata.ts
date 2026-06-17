import type {
  OfficialSourceMetadata,
  SourceDescriptor,
  SourceLabel,
  WeatherSourcesData,
} from "@/lib/types";

export const WEATHER_DATA_SOURCE_NAME = "Open-Meteo";
export const WEATHER_SOURCE_CACHE_SECONDS = 600;

export const SOURCE_LABELS: Record<
  "pagasa" | "lgu" | "ndrrmc" | "community" | "system",
  SourceLabel
> = {
  pagasa: "Official PAGASA Reference",
  lgu: "Official LGU Advisory",
  ndrrmc: "Official NDRRMC/OCD Report",
  community: "Community Report",
  system: "System Weather-Based Alert",
};

export const WEATHER_RISK_DISCLAIMER =
  "Official reference available from PAGASA. Weather risk shown in FloodWatch PH is estimated and not an official flood warning.";

export const WEATHER_RISK_DISCLAIMER_SHORT =
  "Estimated weather-based risk. Follow PAGASA/LGU advisories.";

export const WEATHER_ADVISORY_MESSAGE =
  "For official weather and flood advisories, always check PAGASA and your local LGU.";

export const WEATHER_REFERENCE_LINKS: WeatherSourcesData["links"] = [
  {
    id: "pagasa-home",
    title: "PAGASA Official Website",
    url: "https://www.pagasa.dost.gov.ph/",
    note: "National weather bulletins, rainfall warnings, and storm updates.",
  },
  {
    id: "pagasa-flood",
    title: "PAGASA Flood Information",
    url: "https://www.pagasa.dost.gov.ph/flood",
    note: "Flood outlooks, river basin context, and flood-related guidance.",
  },
  {
    id: "pagasa-hazard-maps",
    title: "PAGASA Flood Hazard Maps",
    url: "https://noah.up.edu.ph/know-your-hazards",
    note: "Hazard map reference for flood-prone locations and public planning.",
  },
  {
    id: "pagasa-hydromet",
    title: "PAGASA Hydromet Monitoring",
    url: "https://panahon.gov.ph/",
    note: "Hydrometeorological monitoring and public weather reference tools.",
  },
];

export function buildSourceDescriptor({
  category,
  name,
  label,
  url,
  note,
  officialSourceName,
  officialSourceUrl,
  officialIssuedAt,
  officialValidUntil,
  officialArea,
  officialSummary,
}: SourceDescriptor): SourceDescriptor {
  return {
    category,
    name,
    label,
    url,
    note,
    officialSourceName,
    officialSourceUrl,
    officialIssuedAt,
    officialValidUntil,
    officialArea,
    officialSummary,
  };
}

export function getWeatherDataSource(): SourceDescriptor {
  return buildSourceDescriptor({
    category: "provider",
    name: WEATHER_DATA_SOURCE_NAME,
    url: "https://open-meteo.com/",
    note: "Live weather measurements and forecast values are served through Open-Meteo.",
  });
}

export function getPagasaOfficialReference(
  metadata: OfficialSourceMetadata = {},
): SourceDescriptor {
  return buildSourceDescriptor({
    category: "official",
    label: SOURCE_LABELS.pagasa,
    name: "PAGASA",
    url: metadata.officialSourceUrl ?? WEATHER_REFERENCE_LINKS[0].url,
    note: WEATHER_ADVISORY_MESSAGE,
    officialSourceName: metadata.officialSourceName ?? "PAGASA",
    officialSourceUrl: metadata.officialSourceUrl ?? WEATHER_REFERENCE_LINKS[0].url,
    officialIssuedAt: metadata.officialIssuedAt,
    officialValidUntil: metadata.officialValidUntil,
    officialArea: metadata.officialArea,
    officialSummary: metadata.officialSummary,
  });
}

export function getSourceLabelFromReportType(sourceType: "Community" | "Official" | "System") {
  if (sourceType === "Official") {
    return SOURCE_LABELS.lgu;
  }

  if (sourceType === "System") {
    return SOURCE_LABELS.system;
  }

  return SOURCE_LABELS.community;
}

export function getSourceCategoryFromReportType(
  sourceType: "Community" | "Official" | "System",
) {
  if (sourceType === "Official") {
    return "official" as const;
  }

  if (sourceType === "System") {
    return "system" as const;
  }

  return "community" as const;
}

export function getWeatherSourcesData(): WeatherSourcesData {
  return {
    dataSource: getWeatherDataSource(),
    officialReference: getPagasaOfficialReference(),
    advisoryMessage: WEATHER_ADVISORY_MESSAGE,
    shortAdvisoryMessage: WEATHER_RISK_DISCLAIMER_SHORT,
    links: WEATHER_REFERENCE_LINKS,
    labels: Object.values(SOURCE_LABELS),
  };
}
