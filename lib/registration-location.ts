import "server-only";

import { randomBytes } from "node:crypto";

import { fetchNominatimReverse } from "@/lib/nominatim";
import { prisma } from "@/lib/prisma";
import { REGISTRATION_VERIFICATION_LIFETIME_MS } from "@/lib/registration-policy";

function text(value: unknown, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) || null : null;
}

export async function createRegistrationLocationVerification(email: string, latitude: number, longitude: number) {
  const payload = await fetchNominatimReverse(latitude, longitude, 18);
  if (!payload || (payload.address?.country_code && payload.address.country_code.toLowerCase() !== "ph")) return null;
  const address = payload.address;
  const streetAddress = text([address?.house_number, address?.road ?? address?.pedestrian ?? address?.residential].filter(Boolean).join(" "));
  const barangay = text(address?.barangay ?? address?.village ?? address?.suburb);
  const cityMunicipality = text(address?.municipality ?? address?.city ?? address?.town ?? address?.county);
  const postalCode = text(address?.postcode, 20);
  const fullAddress = [streetAddress, barangay, cityMunicipality, "Bulacan", postalCode, "Philippines"].filter(Boolean).join(", ");
  // A geocoder outage or missing locality should be recoverable, never silently accepted.
  if (!cityMunicipality) return null;
  const id = randomBytes(32).toString("hex");
  const verifiedAt = new Date();
  await prisma.registrationLocationVerification.deleteMany({ where: { expiresAt: { lt: verifiedAt } } });
  await prisma.registrationLocationVerification.create({
    data: { id, email, fullAddress, streetAddress, barangay, cityMunicipality, postalCode,
      verifiedAt, expiresAt: new Date(verifiedAt.getTime() + REGISTRATION_VERIFICATION_LIFETIME_MS) },
  });
  return { token: id, fullAddress, streetAddress, barangay, cityMunicipality, postalCode,
    province: "Bulacan", country: "Philippines", expiresAt: new Date(verifiedAt.getTime() + REGISTRATION_VERIFICATION_LIFETIME_MS).toISOString() };
}
