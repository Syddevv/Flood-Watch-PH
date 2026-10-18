import { normalizedContactNumber } from "@/lib/emergency-contact-policy";
import type { PublicEmergencyContact } from "@/lib/types";

export type ContactGroup = {
  id: string;
  primary: PublicEmergencyContact;
  records: PublicEmergencyContact[];
  numbers: Array<{ raw: string; telUri: string | null; from: PublicEmergencyContact }>;
};

function groupKey(contact: PublicEmergencyContact) {
  const agency = contact.city === null && /^bulacan pdrrmo(?:\b|\s*\/)/i.test(contact.agencyName)
    ? "bulacan pdrrmo" : contact.agencyName.trim().replace(/\s+/g, " ").toLowerCase();
  const service = agency === "bulacan pdrrmo" ? "provincial disaster response" : contact.category.trim().toLowerCase();
  return `${contact.isNational ? "national" : contact.city?.toLowerCase() ?? "bulacan-wide"}|${service}|${agency}`;
}

function sourceRank(contact: PublicEmergencyContact) {
  return contact.sourceFreshness === "dated_advisory_or_agency_page" ? 2
    : contact.sourceFreshness === "undated_directory" ? 0 : 1;
}

function researchTime(contact: PublicEmergencyContact) {
  const time = Date.parse(contact.lastSourceCheckedAt ?? "");
  return Number.isFinite(time) ? time : 0;
}

function compareContacts(a: PublicEmergencyContact, b: PublicEmergencyContact) {
  return Number(b.preferred) - Number(a.preferred) || sourceRank(b) - sourceRank(a) ||
    Number(a.isStale) - Number(b.isStale) ||
    researchTime(b) - researchTime(a) ||
    a.agencyName.localeCompare(b.agencyName) || a.id.localeCompare(b.id);
}

export function resolveContactGroups(contacts: readonly PublicEmergencyContact[]): ContactGroup[] {
  const grouped = new Map<string, PublicEmergencyContact[]>();
  for (const contact of contacts) {
    const key = groupKey(contact);
    grouped.set(key, [...(grouped.get(key) ?? []), contact]);
  }
  return [...grouped.values()].map((records) => {
    const ordered = records.sort(compareContacts);
    const seenNumbers = new Set<string>();
    const numbers = ordered.flatMap((from) => from.phones.map((phone) => ({ ...phone, from })))
      .filter((phone) => {
        const key = normalizedContactNumber(phone.raw);
        if (seenNumbers.has(key)) return false;
        seenNumbers.add(key);
        return true;
      });
    return { id: ordered[0].id, primary: ordered[0], records: ordered, numbers };
  }).sort((a, b) => Number(b.primary.preferred) - Number(a.primary.preferred) ||
    a.primary.agencyName.localeCompare(b.primary.agencyName));
}

export function matchesContactGroup(group: ContactGroup, query: string, category: string) {
  if (category && !group.records.some((contact) => contact.category === category)) return false;
  const needle = query.trim().toLowerCase();
  return !needle || group.records.some((contact) =>
    `${contact.agencyName} ${contact.category} ${contact.description ?? ""}`.toLowerCase().includes(needle)) ||
    group.numbers.some((phone) => phone.raw.toLowerCase().includes(needle));
}
