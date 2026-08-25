"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useAuthSession } from "@/components/auth-session-provider";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to sign in.");
        return;
      }

      await refresh();
      router.push(searchParams.get("next") ?? "/incident-reports");
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-background)] px-5 py-10 text-[var(--color-foreground)] md:px-8">
      <div className="mx-auto max-w-sm">
        <Link href="/" className="text-sm text-[var(--color-primary)] hover:underline">
          Back to FloodWatch PH
        </Link>
        <h1 className="mt-6 text-2xl font-semibold">Log in</h1>
        <p className="mt-2 text-[0.88rem] text-[var(--color-muted-foreground)]">
          Sign in to submit flood reports and manage the reports you&apos;ve filed.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 grid gap-4">
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
              Email
            </span>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-11 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
              Password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
            />
          </label>

          {error ? (
            <p className="text-[0.84rem] text-[var(--color-danger)]">{error}</p>
          ) : null}

          <button
            type="submit"
            disabled={submitting}
            className="h-11 rounded-[11px] bg-[var(--color-primary)] text-[0.92rem] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Signing in..." : "Log in"}
          </button>
        </form>

        <p className="mt-5 text-[0.84rem] text-[var(--color-muted-foreground)]">
          Don&apos;t have an account?{" "}
          <Link href="/register" className="text-[var(--color-primary)] hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
