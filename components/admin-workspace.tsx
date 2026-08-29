"use client";
import { useRouter } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import type { AuthUser } from "@/components/auth-session-provider";
import { useAuthSession } from "@/components/auth-session-provider";

export function AdminWorkspace({ user }: { user: Exclude<AuthUser, null> }) {
  const router = useRouter();
  const { refresh } = useAuthSession();
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", headers: { Origin: window.location.origin } });
    await refresh();
    router.push("/login");
  }
  return <main className="min-h-screen bg-[var(--color-background)] p-6 sm:p-10"><div className="mx-auto max-w-4xl"><header className="flex items-center justify-between border-b border-[var(--color-border)] pb-5"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-[var(--color-primary)]" /><div><h1 className="text-xl font-semibold">Administrator workspace</h1><p className="text-sm text-[var(--color-muted-foreground)]">Signed in as {user.displayName ?? user.email}</p></div></div><button type="button" onClick={logout} className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm"><LogOut className="h-4 w-4" /> Log out</button></header><section className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><h2 className="font-semibold">Admin access is configured</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Report monitoring and response tools will be added in the next administrative milestone.</p></section></div></main>;
}
