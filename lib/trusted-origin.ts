export function isTrustedOrigin(request: Request, options: { production: boolean; configuredOrigin?: string }) {
  const origin = request.headers.get("origin");
  // Browsers omit Origin on ordinary same-origin reads. Mutations still need it.
  if (!origin) {
    if (!options.production) return true;
    return (request.method === "GET" || request.method === "HEAD") &&
      request.headers.get("sec-fetch-site") !== "cross-site";
  }

  const requestHost = request.headers.get("host");
  if (requestHost) {
    const requestProtocol = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    try {
      const parsedOrigin = new URL(origin);
      if (parsedOrigin.host === requestHost && parsedOrigin.protocol.replace(":", "") === requestProtocol) return true;
    } catch { return false; }
  }

  if (!options.configuredOrigin) return false;
  try { return origin === new URL(options.configuredOrigin).origin; }
  catch { return false; }
}
