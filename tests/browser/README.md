# Browser tests

These Playwright tests cover report submission controls, the map location
picker, in-browser camera capture, the Calumpit reporting geofence, evacuation
center coverage, ownership management, confirmation undo affordances, and
invalid image selection behavior.

Run them against a dev or production server:

```powershell
npx playwright test
# or against an already-running server (prod builds set Secure cookies, which
# require a localhost origin rather than 127.0.0.1):
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3000"; npx playwright test
```

`npm run check:deploy` deliberately does not include this suite - it needs a
browser download and a running server, so it stays opt-in.

## Signing in

`POST /api/reports` has required authentication since Priority 1, and the
report form is replaced by a sign-in prompt once the auth session resolves to
signed-out. Any spec that lingers on the form must therefore register first;
copy the `signIn` helper from `report-camera-capture.spec.ts` or
`calumpit-picker-scope.spec.ts`. A spec that only asserts against the freshly
loaded page can skip it, because the swap happens after the session resolves.

## Rate limits

`auth-register` allows 5 requests per hour, keyed by the anonymous report
session when one exists and by `anonymous` otherwise. Specs that register
before their session cookie is issued therefore share one bucket, so running
the whole suite repeatedly will start returning **429** and the affected specs
fail with `Expected: 201 / Received: 429`.

That is an environment condition, not a product bug. Clear it with:

```ts
await prisma.requestRateLimit.deleteMany({});
```

Delete any users, sessions, reports, and incidents a run created as well - the
specs register real accounts against the configured database.

## Stubbing browser APIs

Two patterns are in use, both preferred over hand-rolled shims where possible.

**Geolocation** uses Playwright's native context API
(`calumpit-picker-scope.spec.ts`):

```ts
await context.grantPermissions(["geolocation"]);
await context.setGeolocation({ latitude: 14.8515, longitude: 120.8162, accuracy: 30 });
```

**Camera** uses Chromium's synthetic capture device, enabled for every project
in `playwright.config.ts` via `--use-fake-device-for-media-stream` and
`--use-fake-ui-for-media-stream`. `getUserMedia` then resolves with a moving
test pattern and no permission prompt, so the capture flow runs in CI without
hardware:

```ts
await context.grantPermissions(["camera"]);
```

To exercise a *failing* camera the fake device has to be displaced before any
app code runs, since it would otherwise succeed
(`report-camera-capture.spec.ts`):

```ts
await page.addInitScript(() => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: {
      getUserMedia: () => {
        const error = new Error("Permission denied");
        error.name = "NotAllowedError";
        return Promise.reject(error);
      },
    },
  });
});
```

Note that the capture button is hidden entirely outside a secure context, so
these specs require `localhost`/`127.0.0.1` rather than a LAN IP over HTTP.
