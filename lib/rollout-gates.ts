export const ROLLOUT_FLAGS = {
  registration: "REGISTRATION_INTAKE_ENABLED",
  reports: "ONSITE_REPORT_INTAKE_ENABLED",
  rescue: "PUBLIC_RESCUE_INTAKE_ENABLED",
  adminActions: "ADMIN_RESCUE_ACTIONS_ENABLED",
  centers: "PUBLIC_CENTER_FEED_ENABLED",
} as const;

export type RolloutFeature = keyof typeof ROLLOUT_FLAGS;
type Environment = Record<string, string | undefined>;

// Existing deployments keep current behavior. An explicit "off" pauses a flow;
// an invalid value also fails closed and is rejected by the deployment check.
export function isRolloutEnabled(feature: RolloutFeature, env: Environment = process.env) {
  const value = env[ROLLOUT_FLAGS[feature]];
  return value === undefined || value === "on";
}

export function pausedRolloutFeature(pathname: string, method: string, env: Environment = process.env): RolloutFeature | null {
  const feature: RolloutFeature | null = method === "POST" && pathname === "/api/auth/register" ? "registration"
    : method === "POST" && pathname === "/api/reports" ? "reports"
    : method === "POST" && pathname === "/api/rescue-requests" ? "rescue"
    : method === "POST" && /^\/api\/admin\/rescue-requests\/[^/]+\/actions$/.test(pathname) ? "adminActions"
    : method === "GET" && /^\/api\/evacuation-centers(?:\/[^/]+)?$/.test(pathname) ? "centers"
    : null;
  return feature && !isRolloutEnabled(feature, env) ? feature : null;
}

export const ROLLOUT_PAUSE_MESSAGES: Record<RolloutFeature, string> = {
  registration: "New account registration is temporarily unavailable. Existing accounts can still sign in.",
  reports: "New flood reports are temporarily unavailable. Existing reports remain available.",
  rescue: "Online rescue requests are temporarily unavailable. If there is immediate danger, call 911.",
  adminActions: "Rescue actions are temporarily unavailable. Follow the operator handover procedure.",
  centers: "The evacuation center directory is temporarily unavailable. Contact the local DRRMO before traveling.",
};
