import { defineConfig, devices } from "@playwright/test";

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const serverURL = new URL(baseURL);

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npm run dev -- --hostname ${serverURL.hostname} --port ${serverURL.port || "3000"}`,
    url: `${baseURL}/api/health`,
    env: { FLOODWATCH_TEST_DIST_DIR: ".next-playwright" },
    reuseExistingServer: !process.env.CI && !process.env.TEST_DATABASE_URL,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Chromium ships a synthetic camera that getUserMedia can open without
        // a real device or a permission prompt, so the capture flow is
        // exercisable in CI. This is the media equivalent of the
        // context.setGeolocation stub used by the picker specs.
        launchOptions: {
          args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"],
        },
      },
    },
  ],
});
