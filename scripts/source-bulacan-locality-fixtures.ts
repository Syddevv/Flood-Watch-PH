/** One-off OSM locality point sourcing; Nominatim requests are serialized. */
import { writeFile } from "node:fs/promises";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { isWithinBulacan } from "@/lib/bulacan-scope";

async function main() {
const points: Array<{ code: string; latitude: number; longitude: number; osmId: number }> = [];
for (const locality of BULACAN_LOCALITIES) {
  const query = new URLSearchParams({ q: `${locality.name}, Bulacan, Philippines`, format: "jsonv2", limit: "5" });
  const response = await fetch(`https://nominatim.openstreetmap.org/search?${query}`, {
    headers: { "User-Agent": "FloodWatchPH/0.1 (Bulacan locality test fixture sourcing)" },
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status} for ${locality.name}`);
  const results = await response.json() as Array<{ lat: string; lon: string; osm_id: number }>;
  const match = results.find((result) => isWithinBulacan(Number(result.lat), Number(result.lon)));
  if (!match) throw new Error(`No in-boundary point for ${locality.name}`);
  points.push({ code: locality.code, latitude: Number(match.lat), longitude: Number(match.lon), osmId: match.osm_id });
  console.log(`${locality.code} ${locality.name}`);
  await new Promise((resolve) => setTimeout(resolve, 1100));
}
await writeFile("tests/fixtures/bulacan-locality-points.json", JSON.stringify({ source: "OpenStreetMap Nominatim", retrievedAt: "2026-10-14", points }, null, 2) + "\n");
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
