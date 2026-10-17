"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuthSession } from "@/components/auth-session-provider";
import { getSafeLocalRedirect } from "@/lib/safe-redirect";

const CODE_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const subscribeToHydration = () => () => undefined;

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh } = useAuthSession();
  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [digits, setDigits] = useState(() => Array(CODE_LENGTH).fill(""));
  const [error, setError] = useState<string | null>(
    searchParams.get("delivery") === "failed"
      ? "We could not send the first email. Use resend to try again."
      : null,
  );
  const [notice, setNotice] = useState<string | null>(
    searchParams.get("sent") === "1"
      ? "A six-digit code was sent. Check your inbox and spam folder."
      : null,
  );
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    () => true,
    () => false,
  );
  const [cooldown, setCooldown] = useState(
    searchParams.get("sent") === "1" ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(
      () => setCooldown((current) => Math.max(0, current - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [cooldown]);

  function setCompleteCode(value: string) {
    const nextDigits = value.replace(/\D/g, "").slice(0, CODE_LENGTH).split("");
    setDigits(Array.from({ length: CODE_LENGTH }, (_, index) => nextDigits[index] ?? ""));
    inputRefs.current[Math.min(nextDigits.length, CODE_LENGTH - 1)]?.focus();
  }

  function handleDigitChange(index: number, value: string) {
    const numeric = value.replace(/\D/g, "");
    if (numeric.length > 1) {
      setCompleteCode(numeric);
      return;
    }
    setDigits((current) => {
      const next = [...current];
      next[index] = numeric;
      return next;
    });
    if (numeric && index < CODE_LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
    if (event.key === "ArrowLeft" && index > 0) inputRefs.current[index - 1]?.focus();
    if (event.key === "ArrowRight" && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLDivElement>) {
    const pasted = event.clipboardData.getData("text");
    if (/\d/.test(pasted)) {
      event.preventDefault();
      setCompleteCode(pasted);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: digits.join("") }),
      });
      const payload = (await response.json()) as { error?: string; code?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to verify this code.");
        return;
      }

      setNotice("Email verified. Redirecting you to Flood Watch…");
      await refresh();
      router.replace(
        getSafeLocalRedirect(searchParams.get("next"), "/incident-reports"),
      );
    } catch {
      setError("Unable to verify your email right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0 || resending) return;
    setError(null);
    setNotice(null);
    setResending(true);

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? "Unable to resend a verification code.");
        return;
      }
      setDigits(Array(CODE_LENGTH).fill(""));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setNotice("If this address has a pending account, a new code will arrive shortly.");
      inputRefs.current[0]?.focus();
    } catch {
      setError("Unable to resend a verification code right now.");
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.85rem]">
        Verify Your Email
      </h1>
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
        Enter the six-digit code sent to your email. It expires after 10 minutes.
      </p>

      <form onSubmit={handleVerify} noValidate className="mt-7 grid gap-5">
        <AuthInput
          id="verification-email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={setEmail}
          placeholder="name@example.com"
        />

        <fieldset className="grid gap-2">
          <legend className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]">
            Six-digit verification code
          </legend>
          <div className="grid grid-cols-6 gap-2" onPaste={handlePaste}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(element) => {
                  inputRefs.current[index] = element;
                }}
                aria-label={`Verification digit ${index + 1}`}
                autoFocus={index === 0}
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(event) => handleDigitChange(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event)}
                className="h-12 min-w-0 rounded-[var(--radius-control)] border border-[var(--color-border)] bg-[var(--color-surface)] text-center text-lg font-semibold text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)]"
              />
            ))}
          </div>
        </fieldset>

        <div aria-live="polite" className="grid gap-3">
          {error ? <AuthAlert title="Verification unsuccessful" message={error} /> : null}
          {notice ? (
            <div
              role="status"
              className="rounded-[var(--radius-panel)] border border-emerald-300 bg-emerald-50 px-3.5 py-3 text-[0.82rem] leading-5 text-emerald-800"
            >
              {notice}
            </div>
          ) : null}
        </div>

        <AuthButton
          loading={submitting}
          loadingLabel="Verifying..."
          disabled={!hydrated}
        >
          Verify email
        </AuthButton>
      </form>

      <button
        type="button"
        onClick={handleResend}
        disabled={!hydrated || cooldown > 0 || resending || !email}
        className="mt-4 h-11 w-full rounded-[var(--radius-control)] border border-[var(--color-border)] text-[0.86rem] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-muted)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {resending
          ? "Sending..."
          : cooldown > 0
            ? `Resend code in ${cooldown}s`
            : "Resend verification code"}
      </button>

      <p className="mt-6 text-center text-[0.82rem] leading-5 text-[var(--color-muted-foreground)]">
        Already verified?{" "}
        <Link href="/login" className="font-medium text-[var(--color-primary)] hover:underline">
          Return to login
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailForm />
    </Suspense>
  );
}
