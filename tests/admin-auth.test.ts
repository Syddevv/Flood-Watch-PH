import test from "node:test";
import assert from "node:assert/strict";
import { getSafeLocalRedirect } from "@/lib/safe-redirect";
import { parseAdminReportFilters } from "@/lib/admin-reports";

test("safe redirects accept local paths and reject open redirects", () => {
  assert.equal(getSafeLocalRedirect("/admin", "/incident-reports"), "/admin");
  assert.equal(getSafeLocalRedirect("/admin?tab=reports", "/incident-reports"), "/admin?tab=reports");
  for (const value of ["https://evil.example", "//evil.example", "/\\evil", "/admin\n"]){
    assert.equal(getSafeLocalRedirect(value, "/incident-reports"), "/incident-reports");
  }
});

test("admin report filters validate statuses and bounded search", () => {
  const valid = parseAdminReportFilters(new URLSearchParams("verificationStatus=verified&sort=severity&order=asc"));
  assert.equal(valid.filters?.verificationStatus, "verified");
  assert.equal(parseAdminReportFilters(new URLSearchParams("verificationStatus=unknown")).error, "Invalid verification status.");
  assert.equal(parseAdminReportFilters(new URLSearchParams(`search=${"x".repeat(101)}`)).error, "Search must not exceed 100 characters.");
});
