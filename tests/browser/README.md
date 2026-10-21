# Browser tests

These Playwright tests cover report submission controls, the map location
picker, in-browser camera capture, the Bulacan reporting boundary, evacuation
center coverage, ownership management, confirmation undo affordances, and
invalid image selection behavior.

Run account-creating specs against a disposable PostgreSQL database with all
Prisma migrations applied. Set `TEST_DATABASE_URL`, `DATABASE_URL`, and
`DIRECT_URL` to that same database. The full suite also needs
`EMAIL_DELIVERY_TEST_STUB=success`, `EMAIL_VERIFICATION_TEST_CODE=123456`,
`REPORT_IMAGE_UPLOAD_TEST_STUB=true`, and test-only auth secrets.

```powershell
$env:PLAYWRIGHT_BASE_URL = "http://localhost:3100"
npx playwright test --workers=1
```

`npm run check:deploy` deliberately does not include the browser suite. GitHub
Actions runs the database-backed A6 acceptance subset against its disposable
PostgreSQL service after API integration tests. The full local suite remains
opt-in and needs a browser download. Playwright starts a server on the selected
localhost port with a separate `.next-playwright` build directory. When
`TEST_DATABASE_URL` is set, it will not reuse an existing server.

## Signing in

`POST /api/reports` has required authentication since Priority 1, and the
report form is replaced by a sign-in prompt once the auth session resolves to
signed-out. Account-creating specs use `registerVerifiedTestUser` from
`verified-test-user.ts` to register and verify an isolated test account.

## Rate limits

`auth-register` allows 5 requests per hour. The verified-user helper assigns a
unique test client address per case so account-creating specs do not share one
bucket. Repeated anonymous session requests from the same address can still
reach the `report-session` limit and log initialization errors.

That is an environment condition, not a product bug. Clear it with:

```ts
await prisma.requestRateLimit.deleteMany({});
```

Delete any users, sessions, reports, and incidents a run created as well - the
specs register real accounts against the configured database.

## Stubbing browser APIs

Two patterns are in use, both preferred over hand-rolled shims where possible.

**Geolocation** uses Playwright's native context API
(`bulacan-picker-scope.spec.ts`):

```ts
await context.grantPermissions(["geolocation"]);
await context.setGeolocation({ latitude: 14.6507, longitude: 121.1029, accuracy: 30 });
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
