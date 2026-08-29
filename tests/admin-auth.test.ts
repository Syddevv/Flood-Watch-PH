import test from "node:test";
import assert from "node:assert/strict";
import { getSafeLocalRedirect } from "@/lib/safe-redirect";

test("safe redirects accept local paths and reject open redirects", () => {
  assert.equal(getSafeLocalRedirect("/admin", "/incident-reports"), "/admin");
  assert.equal(getSafeLocalRedirect("/admin?tab=reports", "/incident-reports"), "/admin?tab=reports");
  for (const value of ["https://evil.example", "//evil.example", "/\\evil", "/admin\n"]){
    assert.equal(getSafeLocalRedirect(value, "/incident-reports"), "/incident-reports");
  }
});
