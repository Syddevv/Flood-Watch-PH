export function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");

  if (!cookieHeader) {
    return "";
  }

  for (const cookie of cookieHeader.split(";")) {
    const [cookieName, ...valueParts] = cookie.trim().split("=");

    if (cookieName === name) {
      return valueParts.join("=");
    }
  }

  return "";
}

export function buildSessionCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  secure: boolean,
) {
  return `${name}=${value}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}
