import {
  AUTH_SESSION_COOKIE_NAME,
  AUTH_SESSION_MAX_AGE_SECONDS,
  generateSessionToken,
  hashSessionToken,
} from "@/lib/auth-session-token";
import { buildSessionCookie, getCookieValue } from "@/lib/cookies";
import { prisma } from "@/lib/prisma";

export { AUTH_SESSION_COOKIE_NAME };

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
};

export async function getAuthenticatedUserFromToken(token: string | null | undefined) {
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    displayName: session.user.displayName,
    role: session.user.role,
  } satisfies AuthenticatedUser;
}

export async function createAuthSession(userId: string) {
  const token = generateSessionToken();
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + AUTH_SESSION_MAX_AGE_SECONDS * 1000);

  await prisma.session.create({
    data: { userId, tokenHash, expiresAt },
  });

  return {
    cookie: buildSessionCookie(
      AUTH_SESSION_COOKIE_NAME,
      token,
      AUTH_SESSION_MAX_AGE_SECONDS,
      process.env.NODE_ENV === "production",
    ),
  };
}

export async function getAuthenticatedUserFromRequest(
  request: Request,
): Promise<AuthenticatedUser | null> {
  const token = getCookieValue(request, AUTH_SESSION_COOKIE_NAME);

  if (!token) {
    return null;
  }

  return getAuthenticatedUserFromToken(token);
}

export async function destroySession(request: Request) {
  const token = getCookieValue(request, AUTH_SESSION_COOKIE_NAME);

  if (token) {
    const tokenHash = hashSessionToken(token);
    try {
      await prisma.session.deleteMany({ where: { tokenHash } });
    } catch (error) {
      console.error("Failed to revoke authentication session during logout.", error);
    }
  }

  return {
    cookie: buildSessionCookie(
      AUTH_SESSION_COOKIE_NAME,
      "",
      0,
      process.env.NODE_ENV === "production",
    ),
  };
}
