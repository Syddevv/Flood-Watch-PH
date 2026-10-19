import { canonicalDirectoryMunicipality } from "@/lib/bulacan-directory";
import { isWithinBulacan } from "@/lib/bulacan-scope";

export type ImportCenterRow = {
  id: string;
  externalKey: string | null;
  name: string;
  address: string;
  city: string;
  province: string;
  latitude: number | null;
  longitude: number | null;
  sourceType: string;
  updatedByUserId: string | null;
  isArchived: boolean;
};

const normalized = (value: string) => value.toLocaleLowerCase("en-PH")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .replace(/\b(reference|and)\b/g, "").replace(/\bsports\b/g, "sport")
  .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");

export function findCenterImportMatch<T extends ImportCenterRow>(rows: T[], candidate: { id: string; name: string; address: string; city: string }) {
  const keyed = rows.find((row) => row.externalKey === candidate.id);
  if (keyed) return { kind: "source_key" as const, row: keyed };
  const city = canonicalDirectoryMunicipality(candidate.city);
  const sameName = rows.filter((row) => canonicalDirectoryMunicipality(row.city) === city &&
    normalized(row.name) === normalized(candidate.name));
  const exact = sameName.filter((row) => !row.externalKey && normalized(row.address) === normalized(candidate.address));
  if (exact.length === 1 && sameName.length === 1) return { kind: "name_location" as const, row: exact[0] };
  if (sameName.length) return { kind: "review" as const, ids: sameName.map((row) => row.id) };
  return { kind: "new" as const };
}

export function legacyCenterQuarantineReason(row: ImportCenterRow) {
  if (row.isArchived || row.externalKey || row.updatedByUserId) return null;
  if (row.province.trim().toLowerCase() !== "bulacan" ||
      (row.latitude !== null && row.longitude !== null && !isWithinBulacan(row.latitude, row.longitude))) return "outside_bulacan";
  if (row.sourceType === "community_reference" && /\breference\s*$/i.test(row.name)) return "demo_reference";
  return null;
}
