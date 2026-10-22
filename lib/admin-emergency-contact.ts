import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { EMERGENCY_CONTACT_CATEGORIES } from "@/lib/emergency-contact-categories";
import { isSafeCenterSourceUrl } from "@/lib/public-evacuation-centers";

const categories = new Set<string>(EMERGENCY_CONTACT_CATEGORIES);
const statuses = new Set(["official_publication_found", "verified", "needs_verification", "outdated"]);

export function parseAdminContactPayload(body: unknown) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { error: "Invalid contact data." };
  const value = body as Record<string, unknown>;
  const text = (key: string, max: number) => typeof value[key] === "string" ? value[key].trim().slice(0, max) : "";
  const agencyName = text("agencyName", 160);
  const category = text("category", 60);
  const cityInput = text("city", 100);
  const city = cityInput ? BULACAN_LOCALITIES.find((locality) => locality.name === cityInput)?.name : null;
  const sourceUrl = text("sourceUrl", 500);
  const evidenceUrl = text("adminEvidenceUrl", 500);
  const verificationStatus = text("verificationStatus", 50);
  const checkedInput = text("lastSourceCheckedAt", 40);
  const lastSourceCheckedAt = checkedInput && !Number.isNaN(Date.parse(checkedInput)) ? new Date(checkedInput) : null;
  const phones = value.phones;
  if (!agencyName || !categories.has(category) || (cityInput && !city) || !statuses.has(verificationStatus)) return { error: "Invalid agency, service, locality, or verification state." };
  if (!Array.isArray(phones) || phones.length === 0 || phones.length > 10 || phones.some((phone) =>
    !phone || typeof phone !== "object" || typeof phone.raw !== "string" || !/^[+\d()\s-]{2,40}$/.test(phone.raw.trim()) || phone.raw.replace(/\D/g, "").length < 3 ||
    (phone.telUri != null && (typeof phone.telUri !== "string" || !/^tel:(?:\+\d{7,15}|\d{3})$/.test(phone.telUri))))) {
    return { error: "Enter at least one raw number; dial links must be supplied valid tel URIs." };
  }
  if (sourceUrl && !isSafeCenterSourceUrl(sourceUrl)) return { error: "Official source must be an HTTPS URL." };
  if (evidenceUrl && !isSafeCenterSourceUrl(evidenceUrl)) return { error: "Evidence must be an HTTPS URL." };
  if (checkedInput && (!lastSourceCheckedAt || lastSourceCheckedAt > new Date())) return { error: "Invalid source research date." };
  if (["verified", "official_publication_found"].includes(verificationStatus) && (!sourceUrl || !lastSourceCheckedAt)) return { error: "Published contacts require an official source and research date." };
  const normalizedPhones = phones.map((phone) => ({ raw: phone.raw.trim(), tel_uri: phone.telUri ?? null }));
  return { data: {
    agencyName, category, city, contactNumber: normalizedPhones[0].raw,
    phones: normalizedPhones,
    sourceUrl: sourceUrl || null, lastSourceCheckedAt, verificationStatus,
    sourceFreshness: text("sourceFreshness", 60) || null,
    preferred: value.preferred === true, isArchived: value.isArchived === true,
    adminEvidenceUrl: evidenceUrl || null, notes: text("notes", 1000) || null,
    duplicateReviewNotes: text("duplicateReviewNotes", 500) || null,
  } };
}
