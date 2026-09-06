"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { useAuthSession } from "@/components/auth-session-provider";
import { getSafeLocalRedirect } from "@/lib/safe-redirect";

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
      router.push(getSafeLocalRedirect(searchParams.get("next"), "/incident-reports"));
    } catch {
      setError("Unable to sign in right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.85rem]">
        Welcome back
      </h1>
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
        Sign in to submit flood reports and manage the reports you&apos;ve filed.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 grid gap-4">
        <AuthInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
        />
        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={setPassword}
        />

        {error ? <AuthAlert title="Unable to sign in" message={error} /> : null}

        <AuthButton loading={submitting} loadingLabel="Signing in...">
          Log in
        </AuthButton>
      </form>

      <p className="mt-6 text-center text-[0.85rem] text-[var(--color-muted-foreground)]">
        Don&apos;t have an account?{" "}
        <Link
          href="/register"
          className="font-medium text-[var(--color-primary)] hover:underline"
        >
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
