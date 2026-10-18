import assert from "node:assert/strict";
import test from "node:test";

import { extractBulacanAddressFields } from "@/lib/report-location";

test("structured Bulacan address fields use known localities only", () => {
  assert.deepEqual(extractBulacanAddressFields({ village: "Bulihan", town: "Plaridel", province: "Bulacan" }), {
    localityCode: "0301417000", barangay: "Bulihan",
  });
  assert.deepEqual(extractBulacanAddressFields({ suburb: "Unknown area", county: "Bulacan" }), {
    localityCode: null, barangay: "Unknown area",
  });
});
