export function isAuthSessionCurrent<T extends { expiresAt: Date }>(
  session: T | null | undefined,
  now = Date.now(),
): session is T {
  return Boolean(session && session.expiresAt.getTime() > now);
}
