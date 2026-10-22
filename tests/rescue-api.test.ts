import assert from "node:assert/strict";
import test from "node:test";
import { rescueApiError } from "@/lib/rescue-api";

test("missing responder tables return a setup error without leaking database details", async () => {
  const request = new Request("http://localhost/api/admin/responders");
  const response = rescueApiError(request, { code: "P2021", meta: { modelName: "ResponderOrganization" } });
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.match(body.error, /rescue dispatch foundation migration/i);
  assert.doesNotMatch(JSON.stringify(body), /P2021|ResponderOrganization/);
});
