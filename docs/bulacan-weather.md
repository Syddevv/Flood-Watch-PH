# Bulacan weather, U1

`data/bulacan-weather-points.ts` selects ten representative points from the dated OSM Nominatim locality fixtures documented in [Bulacan scope](bulacan-scope.md). Their PSGC codes match `data/bulacan-localities.ts`. The points span western floodplain, southern urban, central, northern, and eastern localities. Each Open-Meteo value represents its named point. It is not a province-wide observation or a municipality-wide forecast.

The U0 polygon gates monitored points at startup and gates coordinate, reverse-geocode, search, and forecast provider calls. Geocoder labels do not grant eligibility. Outside coordinates and outside-only search matches return HTTP 400 with an explicit Bulacan scope message. Caller-provided coordinate labels are not trusted; named coordinate lookups display the point coordinates. No Metro Manila or national weather fallback is used.

The overview requests one batch of ten points. Invalid entries get one individual retry, with at most three concurrent retries. A truncated batch loses positional meaning, so every point is retried individually. Valid points remain visible when others fail. The response lists unavailable localities and the last successful fetch time; individual cards show provider update times. If every point fails, the page shows weather unavailable and directs readers to official advisories. It does not show a fabricated provincial risk total.

Overview data refreshes every 120 seconds; selected locations every 600 seconds; static source links every 24 hours. Geocoding uses a 24-hour cache. Forecast cache keys include the U0 boundary version and, for the overview, every monitored code and coordinate. Personal current-location lookups are uncached so a transient reverse-geocode fallback does not become a shared locality label. Request limits are enforced by `lib/request-security.ts`.

Flood Watch risk alerts are model estimates from Open-Meteo conditions. The app does not ingest a live PAGASA or LGU bulletin feed. The official section provides external reference links and states that no live official bulletin is loaded. System alert details identify Flood Watch as the assessment source and label the time as a model update. A dated, attributed official warning would require a separate source integration.

U1 inherits U0's indicative ODbL Bulacan polygon. The authoritative-boundary item in U0 remains open before release.
