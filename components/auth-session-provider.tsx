"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
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

  const refresh = useCallback(async () => {
    try {
      const nextUser = await fetchAuthUser();
      setUser(nextUser);
    } catch (error) {
      console.error("Failed to check the authentication session.", error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAuthUser()
      .then((nextUser) => setUser(nextUser))
      .catch((error: unknown) => {
        console.error("Failed to check the authentication session.", error);
        setUser(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <AuthSessionContext.Provider value={{ user, isLoading, refresh }}>
      {children}
    </AuthSessionContext.Provider>
  );
}

export function useAuthSession() {
  return useContext(AuthSessionContext);
}
