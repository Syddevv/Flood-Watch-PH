const SUPPORTED_TRUSTED_PROXY_HEADERS = [
  "cf-connecting-ip",
  "x-real-ip",
  "x-forwarded-for",
  "x-vercel-forwarded-for",
] as const;

type TrustedProxyHeader = (typeof SUPPORTED_TRUSTED_PROXY_HEADERS)[number];

function normalizeTrustedProxyHeader(value: string | undefined) {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  return SUPPORTED_TRUSTED_PROXY_HEADERS.includes(normalized as TrustedProxyHeader)
    ? (normalized as TrustedProxyHeader)
    : null;
}

function getTrustedProxyAddress(request: Request, configuredHeader?: string) {
  const header = normalizeTrustedProxyHeader(configuredHeader);

  if (!header) {
    return "";
  }

  const value = request.headers.get(header)?.split(",")[0]?.trim() ?? "";

  if (!value || value.length > 128 || /[\r\n]/.test(value)) {
    return "";
  }

  return value;
}

export function getRateLimitIdentity(
  request: Request,
  sessionHash: string,
  configuredProxyHeader?: string,
) {
  if (sessionHash) {
    return `session:${sessionHash}`;
  }

  const trustedAddress = getTrustedProxyAddress(request, configuredProxyHeader);

  if (trustedAddress) {
    return `address:${trustedAddress}`;
  }

  return "anonymous";
}
