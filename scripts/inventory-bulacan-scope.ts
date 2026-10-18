/** Read-only aggregate inventory. Never prints record IDs or personal details. */
import "dotenv/config";
import { EVACUATION_CENTERS } from "@/data/evacuation-centers";
import { isWithinBulacan } from "@/lib/bulacan-scope";
import { isWithinCalumpit } from "@/lib/calumpit-boundary";
import { prisma } from "@/lib/prisma";

function classify(rows: Array<{ latitude: number | null; longitude: number | null }>) {
  return {
    total: rows.length,
    unlocated: rows.filter((row) => row.latitude === null || row.longitude === null).length,
    withinCalumpit: rows.filter((row) => row.latitude !== null && row.longitude !== null && isWithinCalumpit(row.latitude, row.longitude)).length,
    withinBulacan: rows.filter((row) => row.latitude !== null && row.longitude !== null && isWithinBulacan(row.latitude, row.longitude)).length,
    outsideBulacan: rows.filter((row) => row.latitude !== null && row.longitude !== null && !isWithinBulacan(row.latitude, row.longitude)).length,
  };
}

async function main() {
  const [reports, centers] = await Promise.all([
    prisma.floodReport.findMany({ select: { latitude: true, longitude: true } }),
    prisma.evacuationCenter.findMany({ select: { latitude: true, longitude: true } }),
  ]);
  console.log(JSON.stringify({
    databaseReports: classify(reports),
    databaseCenters: classify(centers),
    bundledReferenceCenters: classify(EVACUATION_CENTERS),
  }, null, 2));
}

main().catch((error) => {
  console.error("Scope inventory failed:", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());
