import type { EmergencyContact } from "@prisma/client";

const CONTACT_STALE_MS = 90 * 24 * 60 * 60 * 1000;

export function normalizedContactNumber(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.startsWith("0") && digits.length === 11 ? `63${digits.slice(1)}` : digits;
}

export function isPublishableContact(contact: EmergencyContact, now = new Date()) {
  if (contact.isArchived || contact.verificationStatus !== "verified") return false;
  if (!contact.isNational && contact.province?.toLowerCase() !== "bulacan") return false;
  if (!contact.lastSourceCheckedAt || contact.lastSourceCheckedAt > now) return false;
  if (!contact.sourceUrl) return false;
  try {
    const source = new URL(contact.sourceUrl);
    if (source.protocol !== "https:" || !source.hostname || source.username || source.password) return false;
  } catch { return false; }
  return /^[+\d()\s-]{2,30}$/.test(contact.contactNumber) && normalizedContactNumber(contact.contactNumber).length >= 3;
}

export function toPublicContact(contact: EmergencyContact, now = new Date()) {
  const number = normalizedContactNumber(contact.contactNumber);
  return {
    id: contact.id,
    agencyName: contact.agencyName,
    contactNumber: contact.contactNumber,
    callHref: `tel:${number.startsWith("63") ? "+" : ""}${number}`,
    category: contact.category,
    description: contact.description,
    city: contact.city,
    province: contact.province,
    isNational: contact.isNational,
    sourceUrl: contact.sourceUrl,
    lastSourceCheckedAt: contact.lastSourceCheckedAt?.toISOString() ?? null,
    isStale: !contact.lastSourceCheckedAt || now.getTime() - contact.lastSourceCheckedAt.getTime() > CONTACT_STALE_MS,
  };
}

export function dedupePublicContacts<T extends { contactNumber: string }>(contacts: readonly T[]) {
  const seen = new Set<string>();
  return contacts.filter((contact) => {
    const number = normalizedContactNumber(contact.contactNumber);
    if (seen.has(number)) return false;
    seen.add(number);
    return true;
  });
}
