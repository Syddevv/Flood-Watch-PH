import type { EmergencyContact } from "@prisma/client";

const CONTACT_STALE_MS = 90 * 24 * 60 * 60 * 1000;

export function normalizedContactNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") && digits.length === 11 ? `63${digits.slice(1)}` : digits;
}

export function isPublishableContact(contact: EmergencyContact, now = new Date()) {
  if (contact.isArchived || !["verified", "official_publication_found"].includes(contact.verificationStatus)) return false;
  if (!contact.isNational && contact.province?.toLowerCase() !== "bulacan") return false;
  if (!contact.lastSourceCheckedAt || contact.lastSourceCheckedAt > now) return false;
  if (!contact.sourceUrl) return false;
  try {
    const source = new URL(contact.sourceUrl);
    if (source.protocol !== "https:" || !source.hostname || source.username || source.password) return false;
  } catch { return false; }
  return /^[+\d()\s-]{2,40}$/.test(contact.contactNumber) && normalizedContactNumber(contact.contactNumber).length >= 3;
}

export function toPublicContact(contact: EmergencyContact, now = new Date()) {
  const phones = Array.isArray(contact.phones) ? contact.phones.filter((phone): phone is { raw: string; tel_uri: string | null } =>
    Boolean(phone && typeof phone === "object" && !Array.isArray(phone) && typeof phone.raw === "string" &&
      (phone.tel_uri === null || (typeof phone.tel_uri === "string" && /^tel:(?:\+\d{7,15}|\d{3})$/.test(phone.tel_uri)))))
    .map((phone) => ({ raw: phone.raw, telUri: phone.tel_uri })) : [];
  const publicPhones = phones.length ? phones : [{ raw: contact.contactNumber, telUri: null }];
  const snapshot = contact.sourceSnapshot && typeof contact.sourceSnapshot === "object" && !Array.isArray(contact.sourceSnapshot)
    ? contact.sourceSnapshot as { record?: { notes?: string | null }; sources?: Array<{ title: string; url: string; published_at: string | null }> }
    : null;
  return {
    id: contact.id,
    agencyName: contact.agencyName,
    contactNumber: contact.contactNumber,
    callHref: publicPhones[0].telUri,
    phones: publicPhones,
    category: contact.category,
    description: contact.description,
    city: contact.city,
    province: contact.province,
    isNational: contact.isNational,
    sourceUrl: contact.sourceUrl,
    lastSourceCheckedAt: contact.lastSourceCheckedAt?.toISOString() ?? null,
    isStale: contact.sourceFreshness === "undated_directory" || !contact.lastSourceCheckedAt || now.getTime() - contact.lastSourceCheckedAt.getTime() > CONTACT_STALE_MS,
    sourceFreshness: contact.sourceFreshness,
    preferred: contact.preferred,
    sourceLinks: snapshot?.sources?.filter((source) => { try { return new URL(source.url).protocol === "https:"; } catch { return false; } }).map((source) => ({ title: source.title, url: source.url, publishedAt: source.published_at })) ?? [],
    sourceNotes: snapshot?.record?.notes ?? null,
  };
}

export function dedupePublicContacts<T extends { contactNumber: string; agencyName: string; city: string | null }>(contacts: readonly T[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const key = `${contact.agencyName.toLowerCase()}|${contact.city ?? "province"}|${normalizedContactNumber(contact.contactNumber)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
