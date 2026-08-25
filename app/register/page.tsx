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

const MIN_PASSWORD_LENGTH = 10;

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
    <AuthLayout>
      <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.85rem]">
        Create your account
      </h1>
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
        Create an account to submit and manage flood reports.
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
          autoComplete="new-password"
          required
          minLength={MIN_PASSWORD_LENGTH}
          value={password}
          onChange={setPassword}
          hint="Use at least 10 characters."
        />
        <AuthInput
          id="displayName"
          label="Display name"
          optional
          autoComplete="nickname"
          value={displayName}
          onChange={setDisplayName}
          placeholder="e.g. Juan Dela Cruz"
          hint="Shown only on reports you choose not to submit anonymously."
          maxLength={80}
        />

        {error ? <AuthAlert title="Unable to create your account" message={error} /> : null}

        <AuthButton loading={submitting} loadingLabel="Creating account...">
          Create account
        </AuthButton>
      </form>

      <p className="mt-6 text-center text-[0.85rem] text-[var(--color-muted-foreground)]">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
