const labels: Record<string, string> = {
  unreviewed: "Unreviewed",
  verified: "Verified",
  disputed: "Disputed",
  rejected: "Rejected",
  pending: "Pending",
  pending_review: "Pending Review",
  under_review: "Under review",
  responding: "Responding",
  resolved: "Resolved",
  closed: "Closed",
  outdated: "Outdated",
  needs_verification: "Needs verification",
  official_publication_found: "Official publication found",
  admin_verified: "Admin Verified",
  needs_more_confirmation: "Needs More Confirmation",
  disaster_response: "Disaster Response",
  fire: "Fire",
  hospital: "Hospital",
  medical_assistance: "Medical Assistance",
  police: "Police",
  rescue: "Rescue",
  social_welfare: "Social Welfare",
  pwd_accessible: "PWD accessible",
};

export function formatUiLabel(value: string): string {
  if (labels[value]) return labels[value];
  const spaced = value.replaceAll("_", " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
