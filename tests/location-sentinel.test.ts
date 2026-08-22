import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("the literal 'Your Location' sentinel is not used as a request trigger or fallback value", async () => {
  const files = [
    "lib/weather.ts",
    "components/incident-reports-content.tsx",
    "components/incident-location-picker.tsx",
    "components/weather-monitoring-content.tsx",
  ];

  for (const file of files) {
    const source = await readFile(file, "utf8");
    assert.doesNotMatch(
      source,
      /"Your Location"/,
      `${file} still references the "Your Location" sentinel string`,
    );
  }
});

test("report reverse geocoding retries at a broader zoom when the precise lookup has no usable address", async () => {
  const source = await readFile("lib/report-location.ts", "utf8");

  assert.match(source, /\b18\b/, "expected the primary zoom level to remain 18");
  assert.match(source, /\b14\b/, "expected a broader zoom-14 retry");
});
