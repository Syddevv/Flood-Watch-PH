import "server-only";
import { cookies } from "next/headers";
import { adminErrorResponse } from "@/lib/admin-api-response";
import { getAuthenticatedUserFromRequest, getAuthenticatedUserFromToken, type AuthenticatedUser } from "@/lib/auth-session";

export const ADMIN_ROLE = "admin" as const;
export type UserRole = "user" | "admin";

export function isAdminRole(role: string | null | undefined): role is typeof ADMIN_ROLE {
  return role === ADMIN_ROLE;
}

export function toAdminDto(user: AuthenticatedUser) {
  return { id: user.id, email: user.email, displayName: user.displayName, role: ADMIN_ROLE } as const;
}

export async function getAuthenticatedUserFromCookies() {
  const cookieStore = await cookies();
  return getAuthenticatedUserFromToken(cookieStore.get("floodwatch_auth_session")?.value);
}

export async function requireAdminApi(request: Request) {
  const user = await getAuthenticatedUserFromRequest(request);
  if (!user) return { response: adminErrorResponse(request, "Authentication required.", 401) } as const;
  if (!isAdminRole(user.role)) {
    console.warn(JSON.stringify({ level: "warn", event: "admin-access-denied", userId: user.id }));
    return { response: adminErrorResponse(request, "Administrator access is required.", 403) } as const;
  }
  return { user } as const;
}
