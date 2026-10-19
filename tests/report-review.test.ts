import assert from "node:assert/strict";
import test from "node:test";
import { parseReviewDecision, reviewEvidenceSummary } from "@/lib/report-review";

const base = { verificationStatus: "verified", expectedReviewVersion: 2, expectedUpdatedAt: "2026-10-18T10:00:00.000Z", reason: "Photo and location evidence reviewed." };

test("review decision requires version, timestamp and evidence explanation", () => {
  assert.equal(parseReviewDecision(base).data?.verificationStatus, "verified");
  assert.ok(parseReviewDecision({ ...base, expectedReviewVersion: 0 }).error);
  assert.ok(parseReviewDecision({ ...base, expectedUpdatedAt: "bad" }).error);
  assert.ok(parseReviewDecision({ ...base, verificationStatus: "rejected", reason: "short" }).error);
  assert.ok(parseReviewDecision({ ...base, verificationStatus: "disputed", reason: "" }).error);
  assert.ok(parseReviewDecision({ ...base, publicMessage: 10 }).error);
  assert.ok(parseReviewDecision({ ...base, publicMessage: "Contact resident@example.com" }).error);
  assert.ok(parseReviewDecision({ ...base, publicMessage: "Call 09171234567" }).error);
  assert.equal(parseReviewDecision({ ...base, publicMessage: "  Photo reviewed.\n Location disputed. " }).data?.publicMessage, "Photo reviewed. Location disputed.");
  assert.ok(parseReviewDecision({ ...base, reviewedByUserId: "forged" }).error);
});

test("evidence summary never turns a photo into onsite eligibility", () => {
  assert.deepEqual(reviewEvidenceSummary({ imageUrl: "photo", onsiteEligibleAt: null, gpsCapturedAt: null, photoCapturedAt: null, confirmationCount: 2 }), {
    hasPhoto: true, onsiteEligible: false, hasGpsFix: false, hasCaptureTime: false, communityConfirmations: 2,
  });
});
