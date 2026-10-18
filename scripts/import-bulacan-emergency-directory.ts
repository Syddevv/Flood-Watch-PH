import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

import dataset from "../data/bulacan-emergency-directory.json";
import { canonicalDirectoryMunicipality, sourceLocationRefreshData, sourceRefreshData, validateBulacanDirectory } from "../lib/bulacan-directory";
import { BULACAN_SCOPE_VERSION } from "../lib/bulacan-scope";
import { normalizedContactNumber } from "../lib/emergency-contact-policy";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");
const apply = process.argv.includes("--apply");
const directory = validateBulacanDirectory(dataset);
const sources = new Map(directory.sources.map((source) => [source.id, source]));
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

function sourceSnapshot<T extends { source_ids: string[] }>(record: T) {
  return { record, sources: record.source_ids.map((id) => sources.get(id)!) } as Prisma.InputJsonValue;
}
function date(value: string | null) { return value ? new Date(`${value}T00:00:00+08:00`) : null; }
function centerSource(record: (typeof directory.evacuation_centers)[number]) {
  const source = sources.get(record.source_ids[0])!;
  return {
    name: record.name, address: record.address,
    city: canonicalDirectoryMunicipality(record.municipality)!, province: "Bulacan",
    barangay: record.barangay, latitude: record.latitude, longitude: record.longitude,
    facilityType: record.facility_type, permanent: record.permanent,
    estimatedCapacity: record.capacity_individuals, capacityFamilies: record.capacity_families,
    lastDocumentedEventDate: date(record.last_documented_event_date),
    sourceType: "official_government", sourceName: source.publisher, sourceUrl: source.url,
    sourceCheckedAt: date(record.source_checked_at),
    verificationStatus: "official_publication_found", contactNumber: record.facility_phone,
  };
}
function contactSource(record: (typeof directory.emergency_contacts)[number]) {
  const source = sources.get(record.source_ids[0])!;
  return {
    agencyName: record.agency, contactNumber: record.phones[0].raw,
    phones: record.phones as Prisma.InputJsonValue,
    city: record.municipality ? canonicalDirectoryMunicipality(record.municipality)! : null,
    province: "Bulacan", region: "Region III", isNational: false,
    category: record.category, sourceUrl: source.url,
    lastSourceCheckedAt: date(record.source_checked_at),
    verificationStatus: "official_publication_found", sourceFreshness: record.source_freshness,
    preferred: record.preferred,
  };
}

async function main() {
  const summary = { facilities: directory.evacuation_centers.length, contacts: directory.emergency_contacts.length,
    sources: directory.sources.length, createdCenters: 0, updatedCenters: 0, createdContacts: 0,
    updatedContacts: 0, potentialDuplicates: [] as string[] };
  const run = async (tx: Prisma.TransactionClient) => {
    const centers = await tx.evacuationCenter.findMany({ select: {
      id: true, externalKey: true, name: true, city: true, barangay: true, latitude: true, longitude: true,
      updatedByUserId: true, sourceSnapshot: true,
    } });
    const contacts = await tx.emergencyContact.findMany({ select: {
      id: true, sourceKey: true, agencyName: true, city: true, contactNumber: true,
      updatedByUserId: true,
    } });
    for (const record of directory.evacuation_centers) {
      const existing = centers.find((row) => row.externalKey === record.id);
      const values = centerSource(record);
      const duplicates = centers.filter((row) => row.externalKey !== record.id && row.city === values.city &&
        (row.name.toLowerCase() === values.name.toLowerCase() ||
          (values.barangay && row.barangay?.toLowerCase() === values.barangay.toLowerCase())));
      if (duplicates.length) summary.potentialDuplicates.push(`facility ${record.id}: ${duplicates.map((row) => row.id).join(", ")}`);
      if (existing) {
        summary.updatedCenters++;
        if (apply) await tx.evacuationCenter.update({ where: { id: existing.id }, data: sourceLocationRefreshData(existing, values, sourceSnapshot(record)) });
      } else {
        summary.createdCenters++;
        const created = apply ? await tx.evacuationCenter.create({ data: {
          ...values, externalKey: record.id, sourceSnapshot: sourceSnapshot(record),
          scopeVersion: BULACAN_SCOPE_VERSION, facilities: [], status: "needs_verification",
          duplicateReviewNotes: duplicates.length ? `Potential match: ${duplicates.map((row) => row.id).join(", ")}` : null,
        } }) : null;
        centers.push({ id: created?.id ?? record.id, externalKey: record.id, name: values.name, city: values.city,
          barangay: values.barangay, latitude: values.latitude, longitude: values.longitude, updatedByUserId: null,
          sourceSnapshot: sourceSnapshot(record) as Prisma.JsonValue });
      }
    }
    for (const record of directory.emergency_contacts) {
      const existing = contacts.find((row) => row.sourceKey === record.id);
      const values = contactSource(record);
      const numbers = new Set(record.phones.map((phone) => normalizedContactNumber(phone.raw)));
      const duplicates = contacts.filter((row) => row.sourceKey !== record.id &&
        row.city === values.city && numbers.has(normalizedContactNumber(row.contactNumber)));
      if (duplicates.length) summary.potentialDuplicates.push(`contact ${record.id}: ${duplicates.map((row) => row.id).join(", ")}`);
      if (existing) {
        summary.updatedContacts++;
        if (apply) await tx.emergencyContact.update({ where: { id: existing.id }, data: sourceRefreshData(existing.updatedByUserId, values, sourceSnapshot(record)) });
      } else {
        summary.createdContacts++;
        const created = apply ? await tx.emergencyContact.create({ data: {
          ...values, sourceKey: record.id, sourceSnapshot: sourceSnapshot(record),
          duplicateReviewNotes: duplicates.length ? `Potential match: ${duplicates.map((row) => row.id).join(", ")}` : null,
        } }) : null;
        contacts.push({ id: created?.id ?? record.id, sourceKey: record.id, agencyName: values.agencyName,
          city: values.city, contactNumber: values.contactNumber, updatedByUserId: null });
      }
    }
  };
  if (apply) await prisma.$transaction(run, { timeout: 120_000 });
  else await run(prisma);
  console.log(JSON.stringify({ mode: apply ? "applied" : "dry-run", ...summary }, null, 2));
}

main().catch((error) => { console.error("Directory import failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
