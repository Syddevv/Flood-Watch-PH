"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import { useAuthSession } from "@/components/auth-session-provider";

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuthSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(payload.error ?? "Unable to create your account.");
        return;
      }

      await refresh();
      router.push(searchParams.get("next") ?? "/incident-reports");
    } catch {
      setError("Unable to create your account right now. Please try again.");
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
        <h1 className="mt-6 text-2xl font-semibold">Create an account</h1>
        <p className="mt-2 text-[0.88rem] text-[var(--color-muted-foreground)]">
          Only an email and password are required. Submitting a flood report requires an account.
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
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-11 rounded-[11px] border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 text-[0.92rem] text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)]"
            />
            <span className="text-[0.74rem] text-[var(--color-muted-foreground)]">
              At least 10 characters.
            </span>
          </label>
          <label className="grid gap-1.5">
            <span className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
              Display name (optional)
            </span>
            <input
              type="text"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={80}
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
            {submitting ? "Creating account..." : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-[0.84rem] text-[var(--color-muted-foreground)]">
          Already have an account?{" "}
          <Link href="/login" className="text-[var(--color-primary)] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
