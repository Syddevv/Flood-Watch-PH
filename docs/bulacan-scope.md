# Bulacan scope, U0

## Boundary and locality sources

- **Operational boundary version:** `osm-1504656-2026-10-14` (OpenStreetMap relation [1504656](https://www.openstreetmap.org/relation/1504656), retrieved 14 October 2026 through Nominatim). The complete response is preserved in [`data/sources/bulacan-osm-nominatim-2026-10-14.json`](../data/sources/bulacan-osm-nominatim-2026-10-14.json). [`data/bulacan-boundary.geojson`](../data/bulacan-boundary.geojson) is the canonical GeoJSON feature; [`data/bulacan-boundary.json`](../data/bulacan-boundary.json) is an identical JSON import copy for the application bundler. Both copies have SHA-256 `4330731730D34A9F44AE30258D6972E617D2FD3AC92CEAD5C01DDD4F756ED0B4`. No geometric simplification or coordinate rounding was applied. Coordinates remain GeoJSON `[longitude, latitude]`; the application converts them to Leaflet `[latitude, longitude]` once.
- **Reuse terms:** Boundary and locality test-point geometry are © OpenStreetMap contributors, [Open Database License 1.0](https://www.openstreetmap.org/copyright). Keep this attribution and the ODbL link with redistributed boundary data. The map tile attribution remains visible.
- **Locality vocabulary:** 24 cities and municipalities with ten-digit codes from the [Philippine Statistics Authority Bulacan PSGC page](https://psa.gov.ph/classification/psgc/citimuni/0301400000), viewed 14 October 2026. The master list is marked as of 30 September 2026. The list lives in `data/bulacan-localities.ts`. Test points for all 24 localities were fetched from OSM Nominatim on 14 October 2026 and are recorded in `tests/fixtures/bulacan-locality-points.json`; they are representative points, not official locality centroids.

**Authority limit:** This OSM boundary has a clear reuse license, but it is not an officially adjudicated provincial boundary. A [DPWH layer](https://services1.arcgis.com/IwZZTMxZCmAmFYvF/ArcGIS/rest/services/Provincial_Boundary/FeatureServer/0) credits NAMRIA/DPWH and dates the underlying geometry to August 2017, but its redistribution terms are unclear. NAMRIA's [FAQ](https://namria.gov.ph/faq.aspx) describes restrictions on digital data obtained under its agreement. The U0 authoritative-boundary requirement therefore remains open pending an official, licensed source or written permission. The current polygon is an indicative operational gate and must be checked against local government boundary decisions before release.

## Point and display policy

- The same polygon is used by report creation, public reports/map reads, nearby reports, geocoding, and both public maps. Bounding boxes are only prefilters. Exterior polygon edges and vertices count as inside; hole interiors and edges count as outside. Invalid coordinates fail closed.
- The main map and picker fit the whole province at initial load; zoom controls and pan limits permit the entire outline. Public static evacuation-center references are selected by polygon. All remain marked as unverified; U4 will replace them with sourced canonical records.
- Reports created under the old scope stay in the database. The U0 migration tags existing reports and database centers as `legacy-calumpit-unversioned` and gives future records the current scope version. Legacy reports inside Bulacan remain in public feeds if their lifecycle status permits it. Reports outside Bulacan are absent from public feeds and detail URLs, but their owners and admins can still access details. Database center rows remain available to admins; current public center views use only in-province static references until A2/U4 supply a canonical center API. No rows are deleted.
- If the boundary import is invalid or unavailable, module initialization fails, so writes cannot bypass the gate. Reads return an unavailable response rather than silently expanding coverage.

## Read-only legacy inventory

The read-only `scripts/inventory-bulacan-scope.ts` query on 14 October 2026 returned:

| Dataset | Total | Within Calumpit | Within Bulacan | Outside Bulacan |
| --- | ---: | ---: | ---: | ---: |
| Database reports | 47 | 8 | 37 | 10 |
| Database centers | 3 | 0 | 0 | 3 |
| Bundled reference centers | 35 | 1 | 13 | 22 |

Counts are a snapshot, not a migration or a deletion. Rerun the script before rollout. Apply the committed migration using the normal deployment process against the intended database; this change set does not apply it to production.

## Names retained for compatibility

The visible product name is **Flood Watch**. The package name `floodwatchph`, CSS classes, historical Calumpit polygon module, existing logo asset URL, Nominatim User-Agent identifier, database table names, session/cookie keys, deployed hostnames, and historical change logs remain technical identifiers. Changing those would require a separate compatibility migration. The logo artwork contains no old wordmark; its alternative text now says “Flood Watch logo.”
