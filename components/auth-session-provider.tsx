"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  fullName?: string | null;
  role: string;
} | null;

type AuthSessionState = {
  user: AuthUser;
  isLoading: boolean;
  refresh: () => Promise<void>;
};

const AuthSessionContext = createContext<AuthSessionState>({
  user: null,
  isLoading: true,
  refresh: async () => {},
});

async function fetchAuthUser(): Promise<AuthUser> {
  const response = await fetch("/api/auth/session", { cache: "no-store" });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { data?: { user: AuthUser } };
  return payload.data?.user ?? null;
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser>(null);
  const [isLoading, setIsLoading] = useState(true);
  const latestRequest = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequest.current;
    try {
      const nextUser = await fetchAuthUser();
      if (requestId === latestRequest.current) setUser(nextUser);
    } catch (error) {
      console.error("Failed to check the authentication session.", error);
      if (requestId === latestRequest.current) setUser(null);
    } finally {
      if (requestId === latestRequest.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refresh(), 0);
    const onFocus = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearTimeout(initialRefresh);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      latestRequest.current += 1;
    };
  }, [refresh]);

  return (
    <AuthSessionContext.Provider value={{ user, isLoading, refresh }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
