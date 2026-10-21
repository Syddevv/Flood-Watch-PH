export const REPORT_VERIFICATION_STATES = ["unreviewed", "verified", "disputed", "rejected"] as const;
export type ReportVerificationState = (typeof REPORT_VERIFICATION_STATES)[number];

export function isReportVerificationState(value: unknown): value is ReportVerificationState {
  return typeof value === "string" && REPORT_VERIFICATION_STATES.includes(value as ReportVerificationState);
}

export function parseReviewDecision(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { error: "Invalid review decision." } as const;
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some((key) => !["verificationStatus", "expectedReviewVersion", "expectedUpdatedAt", "reason", "publicMessage"].includes(key))) return { error: "Invalid review fields." } as const;
  if (!isReportVerificationState(body.verificationStatus)) return { error: "Invalid verification status." } as const;
  if (!Number.isSafeInteger(body.expectedReviewVersion) || (body.expectedReviewVersion as number) < 1) return { error: "Review version is required." } as const;
  const updatedAt = typeof body.expectedUpdatedAt === "string" ? new Date(body.expectedUpdatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) return { error: "Expected report update time is required." } as const;
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const publicMessage = typeof body.publicMessage === "string" ? body.publicMessage.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim() : "";
  if (reason.length > 2000 || publicMessage.length > 500 ||
      (body.reason !== undefined && typeof body.reason !== "string") ||
      (body.publicMessage !== undefined && typeof body.publicMessage !== "string")) return { error: "Invalid review explanation." } as const;
  if (reason.length < 10) return { error: "Record the evidence or reason for this review change (at least 10 characters)." } as const;
  if (publicMessage && body.verificationStatus === "unreviewed") return { error: "Public feedback requires a completed review." } as const;
  if (publicMessage && (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(publicMessage) || /(?:\+?\d[\d\s().-]{7,}\d)/.test(publicMessage) || /(?:https?:\/\/|www\.)\S+/i.test(publicMessage))) return { error: "Public feedback must not include contact details or links." } as const;
  return { data: { verificationStatus: body.verificationStatus, expectedReviewVersion: body.expectedReviewVersion as number, expectedUpdatedAt: updatedAt, reason: reason || null, publicMessage: publicMessage || null } } as const;
}

export function reviewEvidenceSummary(report: { imageUrl: string | null; onsiteEligibleAt: Date | null; gpsCapturedAt: Date | null; photoCapturedAt: Date | null; confirmationCount: number }) {
  return {
    hasPhoto: Boolean(report.imageUrl),
    onsiteEligible: Boolean(report.onsiteEligibleAt),
    hasGpsFix: Boolean(report.gpsCapturedAt),
    hasCaptureTime: Boolean(report.photoCapturedAt),
    communityConfirmations: report.confirmationCount,
  };
}
