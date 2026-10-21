import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";

export type DirectorySource = {
  id: string; title: string; publisher: string; url: string;
  published_at: string | null; checked_at: string; kind: string; note: string | null;
};
export type DirectoryPhone = { raw: string; e164: string | null; tel_uri: string | null };
export type DirectoryCenter = {
  id: string; name: string; municipality: string; barangay: string | null;
  province: string; country: string; address: string; facility_type: string;
  permanent: boolean | null; latitude: number | null; longitude: number | null;
  coordinate_method: string | null; coordinate_precision: string | null;
  coordinate_candidate?: unknown;
  location_source_ids?: string[]; location_checked_at?: string;
  location_label?: string; location_notes?: string;
  location_verification_status?: string;
  capacity_individuals: number | null; capacity_families: number | null;
  capacity_basis: string | null; current_occupancy: number | null;
  current_available_spaces: number | null; operational_status: string;
  status_checked_at: string | null; source_checked_at: string;
  verification_status: string; evidence_basis: string;
  last_documented_event_date: string | null; source_ids: string[];
  public_display_recommendation: string; map_display_recommendation: string;
  facility_phone: string | null; notes: string | null;
};
export type DirectoryContact = {
  id: string; municipality: string | null; province: string; agency: string;
  category: string; scope: string; phones: DirectoryPhone[]; source_ids: string[];
  source_checked_at: string; verification_status: string; call_tested: boolean;
  operational_status: string; source_freshness: string; preferred: boolean;
  public_display_recommendation: string; notes: string | null;
};
export type DirectoryDataset = {
  schema_version: string; dataset_id: string; province: string; country: string;
  verification_policy: Record<string, unknown>; import_guidance: Record<string, unknown>;
  coverage_by_municipality: Array<{ municipality: string; emergency_contact_record_count: number; evacuation_center_record_count: number }>;
  evacuation_centers: DirectoryCenter[]; emergency_contacts: DirectoryContact[];
  sources: DirectorySource[]; excluded_or_unresolved: Array<{ name: string; source_ids: string[]; reason: string }>;
  known_limitations: string[];
};

const aliases: Record<string, string> = {
  Baliwag: "City of Baliwag", "Baliwag City": "City of Baliwag",
  Malolos: "City of Malolos", "Malolos City": "City of Malolos",
  Meycauayan: "City of Meycauayan", "Meycauayan City": "City of Meycauayan",
  "San Jose del Monte": "City of San Jose Del Monte", "San Jose del Monte City": "City of San Jose Del Monte",
  Bulakan: "Bulacan",
};

export function canonicalDirectoryMunicipality(value: string) {
  const input = value.trim().toLocaleLowerCase("en-PH");
  const name = Object.entries(aliases).find(([alias]) => alias.toLocaleLowerCase("en-PH") === input)?.[1] ?? value.trim();
  return BULACAN_LOCALITIES.find((locality) => locality.name.toLocaleLowerCase("en-PH") === name.toLocaleLowerCase("en-PH"))?.name ?? null;
}

export function directoryLocalityCode(value: string) {
  const name = canonicalDirectoryMunicipality(value);
  return BULACAN_LOCALITIES.find((locality) => locality.name === name)?.code ?? null;
}

export function sourceRefreshData<T extends object, S>(updatedByUserId: string | null, values: T, sourceSnapshot: S) {
  return { ...(updatedByUserId ? {} : values), sourceSnapshot };
}

export function sourceLocationRefreshData<T extends { latitude: number | null; longitude: number | null }, S>(
  existing: { updatedByUserId: string | null; latitude: number | null; longitude: number | null; sourceSnapshot: unknown },
  values: T,
  nextSnapshot: S,
) {
  const refresh = sourceRefreshData(existing.updatedByUserId, values, nextSnapshot);
  if (!existing.updatedByUserId) return refresh;
  const snapshot = existing.sourceSnapshot;
  const previous = snapshot && typeof snapshot === "object" && !Array.isArray(snapshot) && "record" in snapshot
    ? snapshot.record : null;
  const previousCoordinates = previous && typeof previous === "object" && "latitude" in previous && "longitude" in previous
    ? previous : null;
  if (values.latitude !== null && existing.latitude === null && existing.longitude === null &&
      previousCoordinates?.latitude === null && previousCoordinates.longitude === null) {
    return { ...refresh, latitude: values.latitude, longitude: values.longitude };
  }
  return refresh;
}

function validDate(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function officialHttps(value: unknown) {
  if (typeof value !== "string") return false;
  try { const url = new URL(value); return url.protocol === "https:" && !!url.hostname && !url.username && !url.password; }
  catch { return false; }
}

function uniqueIds(items: Array<{ id: string }>, label: string) {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item || typeof item.id !== "string" || !/^[a-z0-9-]+$/.test(item.id) || seen.has(item.id)) throw new Error(`Invalid or repeated ${label} ID.`);
    seen.add(item.id);
  }
}

export function validateBulacanDirectory(value: unknown): DirectoryDataset {
  if (!value || typeof value !== "object") throw new Error("Directory must be an object.");
  const data = value as DirectoryDataset;
  if (!["1.0.0", "1.1.0"].includes(data.schema_version) || data.country !== "PH" || data.province !== "Bulacan" ||
      !data.verification_policy || !data.import_guidance || !Array.isArray(data.known_limitations) ||
      !Array.isArray(data.coverage_by_municipality) || !Array.isArray(data.sources) ||
      !Array.isArray(data.evacuation_centers) || !Array.isArray(data.emergency_contacts) ||
      !Array.isArray(data.excluded_or_unresolved)) throw new Error("Unsupported directory structure.");
  uniqueIds(data.sources, "source"); uniqueIds(data.evacuation_centers, "facility"); uniqueIds(data.emergency_contacts, "contact");
  const sourceIds = new Set(data.sources.map((source) => source.id));
  for (const source of data.sources) {
    if (!officialHttps(source.url) || !validDate(source.checked_at) ||
        (source.published_at !== null && !validDate(source.published_at))) throw new Error(`Invalid source ${source.id}.`);
  }
  const checkSources = (item: { source_ids: string[] }, id: string) => {
    if (!Array.isArray(item.source_ids) || item.source_ids.length === 0 ||
        item.source_ids.some((sourceId) => !sourceIds.has(sourceId))) throw new Error(`Unknown source on ${id}.`);
  };
  for (const center of data.evacuation_centers) {
    checkSources(center, center.id);
    if (center.location_source_ids) checkSources({ source_ids: center.location_source_ids }, center.id);
    if (!center.name || !center.address || center.province !== "Bulacan" || center.country !== "PH" ||
        !canonicalDirectoryMunicipality(center.municipality) || !validDate(center.source_checked_at) ||
        center.verification_status !== "official_publication_found" ||
        !["unknown", "open", "closed", "full"].includes(center.operational_status) ||
        (center.status_checked_at !== null && !validDate(center.status_checked_at)) ||
        (center.last_documented_event_date !== null && !validDate(center.last_documented_event_date)) ||
        (center.latitude === null) !== (center.longitude === null) ||
        (center.coordinate_candidate != null && center.latitude !== null) ||
        (center.location_verification_status && (!center.location_source_ids?.length || !center.location_checked_at ||
          !validDate(center.location_checked_at) || !center.coordinate_precision || !center.location_notes)) ||
        (center.latitude !== null && (!Number.isFinite(center.latitude) || !Number.isFinite(center.longitude) ||
          !isWithinBulacan(center.latitude, center.longitude!))) ||
        (center.capacity_individuals !== null && (!Number.isSafeInteger(center.capacity_individuals) || center.capacity_individuals < 0)) ||
        (center.capacity_families !== null && (!Number.isSafeInteger(center.capacity_families) || center.capacity_families < 0)) ||
        center.current_occupancy !== null || center.current_available_spaces !== null) {
      throw new Error(`Invalid facility ${center.id}.`);
    }
  }
  for (const contact of data.emergency_contacts) {
    checkSources(contact, contact.id);
    if (!contact.agency || contact.province !== "Bulacan" ||
        (contact.municipality !== null && !canonicalDirectoryMunicipality(contact.municipality)) ||
        !validDate(contact.source_checked_at) || contact.verification_status !== "official_publication_found" ||
        contact.operational_status !== "unknown" || contact.call_tested !== false ||
        !Array.isArray(contact.phones) || contact.phones.length === 0 ||
        contact.phones.some((phone) => !phone.raw || (phone.tel_uri !== null && !/^tel:(?:\+\d{7,15}|\d{3})$/.test(phone.tel_uri)))) {
      throw new Error(`Invalid contact ${contact.id}.`);
    }
  }
  for (const excluded of data.excluded_or_unresolved) checkSources(excluded, excluded.name);
  const covered = new Set(data.coverage_by_municipality.map((row) => canonicalDirectoryMunicipality(row.municipality)));
  if (covered.size !== BULACAN_LOCALITIES.length || covered.has(null)) throw new Error("Directory coverage must name all Bulacan LGUs.");
  for (const row of data.coverage_by_municipality) {
    const centers = data.evacuation_centers.filter((center) => center.municipality === row.municipality).length;
    const contacts = data.emergency_contacts.filter((contact) => contact.municipality === row.municipality).length;
    if (centers !== row.evacuation_center_record_count || contacts !== row.emergency_contact_record_count) throw new Error(`Coverage count mismatch for ${row.municipality}.`);
  }
  return data;
}
