import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { normalizedContactNumber } from "../lib/emergency-contact-policy";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) throw new Error("DIRECT_URL or DATABASE_URL is required.");

const checkedAt = new Date("2026-10-18T00:00:00+08:00");
const contacts = [
  {
    sourceKey: "national-emergency-911",
    agencyName: "National Emergency Hotline 911",
    contactNumber: "911",
    category: "Emergency Response",
    description: "Nationwide emergency fallback.",
    sourceUrl: "https://ehotlines.e.gov.ph/",
    isNational: true,
    province: null,
    city: null,
  },
  {
    sourceKey: "bulacan-pdrrmo-landline",
    agencyName: "Bulacan PDRRMO",
    contactNumber: "+63 (44) 791-0566",
    category: "Disaster Coordination",
    description: "Provincial disaster response and coordination landline.",
    sourceUrl: "https://pdrrmo.bulacan.gov.ph/contact-us/",
    isNational: false,
    province: "Bulacan",
    city: null,
  },
  {
    sourceKey: "bulacan-pdrrmo-globe",
    agencyName: "Bulacan PDRRMO",
    contactNumber: "0905-333-3319",
    category: "Disaster Coordination",
    description: "Provincial disaster response mobile number (Globe).",
    sourceUrl: "https://pdrrmo.bulacan.gov.ph/contact-us/",
    isNational: false,
    province: "Bulacan",
    city: null,
  },
  {
    sourceKey: "bulacan-pdrrmo-sun",
    agencyName: "Bulacan PDRRMO",
    contactNumber: "0942-367-1455",
    category: "Disaster Coordination",
    description: "Provincial disaster response mobile number (Sun).",
    sourceUrl: "https://pdrrmo.bulacan.gov.ph/contact-us/",
    isNational: false,
    province: "Bulacan",
    city: null,
  },
] as const;

const apply = process.argv.includes("--apply");
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

async function main() {
  const stored = await prisma.emergencyContact.findMany({
    select: { id: true, agencyName: true, contactNumber: true, sourceKey: true, sourceUrl: true, verificationStatus: true },
  });
  for (const contact of contacts) {
    const existing = stored.find((row) => row.sourceKey === contact.sourceKey);
    if (existing) {
      console.log(`skip ${contact.sourceKey}: already imported; admin edits preserved`);
      continue;
    }
    const sameNumber = stored.filter((row) => normalizedContactNumber(row.contactNumber) === normalizedContactNumber(contact.contactNumber));
    if (sameNumber.length > 1 || sameNumber.some((row) =>
      row.agencyName !== contact.agencyName || row.sourceKey || row.sourceUrl || row.verificationStatus === "verified"
    )) {
      console.log(`review ${contact.sourceKey}: matching number needs manual reconciliation`);
      continue;
    }
    const action = sameNumber.length === 1 ? "backfill" : "create";
    console.log(`${apply ? "apply" : "dry-run"} ${action} ${contact.sourceKey}`);
    if (!apply) continue;
    const data = { ...contact, lastSourceCheckedAt: checkedAt, verificationStatus: "verified" };
    if (action === "backfill") {
      await prisma.emergencyContact.update({ where: { id: sameNumber[0].id }, data });
    } else {
      await prisma.emergencyContact.create({ data });
    }
  }
}

main().finally(() => prisma.$disconnect());
