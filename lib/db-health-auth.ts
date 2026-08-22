export function isDatabaseHealthRequestAuthorized(request: Request) {
  const configuredToken = process.env.DB_HEALTH_TOKEN?.trim();

  if (!configuredToken) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization")?.trim();
  return authorization === `Bearer ${configuredToken}`;
}
