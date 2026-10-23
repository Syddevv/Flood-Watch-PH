"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle, MapPin } from "lucide-react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLayout } from "@/components/auth/auth-layout";
import { PasswordInput } from "@/components/auth/password-input";
import { getSafeLocalRedirect } from "@/lib/safe-redirect";
import { isValidRegistrationPassword, normalizeFullName, registrationEmail } from "@/lib/registration-policy";

const MIN_PASSWORD_LENGTH = 10;

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [location, setLocation] = useState<{ token: string; fullAddress: string; streetAddress: string | null; barangay: string | null; cityMunicipality: string | null; postalCode: string | null } | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "verified" | "outside" | "denied" | "unavailable">("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const [touched, setTouched] = useState({ fullName: false, email: false, password: false, confirmPassword: false });
  const [submitting, setSubmitting] = useState(false);
  const locationRequest = useRef(0);

  function touch(field: keyof typeof touched) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  const fullNameError = (touched.fullName || attemptedSubmit) && !normalizeFullName(fullName)
    ? "Enter a given name and family name using letters, spaces, apostrophes, periods, or hyphens." : undefined;
  const emailError = (touched.email || attemptedSubmit) && !registrationEmail(email)
    ? "Enter a valid email address." : undefined;
  const passwordError = (touched.password || attemptedSubmit) && !isValidRegistrationPassword(password)
    ? "Use 10–200 characters with letters and a number or symbol." : undefined;
  const confirmPasswordError = (touched.confirmPassword || attemptedSubmit) && !confirmPassword
    ? "Confirm your password." : confirmPassword && password !== confirmPassword ? "Passwords do not match." : undefined;

  function changeEmail(value: string) {
    locationRequest.current += 1;
    setEmail(value);
    setError(null);
    setLocation(null);
    setLocationState("idle");
  }

  function detectLocation() {
    const requestId = ++locationRequest.current;
    setError(null);
    setLocation(null);
    setLocationMessage(null);
    setLocationState("loading");
    if (!navigator.geolocation) {
      setLocationState("unavailable");
      return;
    }
    navigator.geolocation.getCurrentPosition(async (position) => {
      if (requestId !== locationRequest.current) return;
      try {
        const response = await fetch("/api/auth/verify-location", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, latitude: position.coords.latitude, longitude: position.coords.longitude,
            accuracy: position.coords.accuracy, capturedAt: position.timestamp }),
        });
        const payload = await response.json() as { data?: typeof location & { token: string }; error?: string };
        if (requestId !== locationRequest.current) return;
        if (!response.ok || !payload.data) {
          setLocationState(response.status === 403 ? "outside" : "unavailable");
          setLocationMessage(payload.error ?? null);
          return;
        }
        setLocation(payload.data);
        setStreetAddress(payload.data.streetAddress ?? "");
        setLocationState("verified");
      } catch {
        if (requestId === locationRequest.current) setLocationState("unavailable");
      }
    }, (failure) => {
      if (requestId === locationRequest.current) setLocationState(failure.code === 1 ? "denied" : "unavailable");
    }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20_000 });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setAttemptedSubmit(true);
    if (!location || !normalizeFullName(fullName) || !registrationEmail(email) || !isValidRegistrationPassword(password) || password !== confirmPassword) {
      setError(!location ? "Detect and verify your current location before creating an account." : null);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: normalizeFullName(fullName),
          locationToken: location.token,
          streetAddress,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        code?: string;
        email?: string;
        data?: { email?: string };
      };

      const verificationEmail = payload.data?.email ?? payload.email ?? email;
      if (payload.code === "VERIFICATION_DELIVERY_FAILED") {
        const params = new URLSearchParams({ email: verificationEmail, delivery: "failed" });
        const next = getSafeLocalRedirect(searchParams.get("next"), "");
        if (next) params.set("next", next);
        router.push(`/verify-email?${params.toString()}`);
        return;
      }

      if (!response.ok) {
        setError(payload.error ?? "Unable to create your account.");
        if (response.status === 409 && payload.error?.includes("Location verification")) {
          setLocation(null);
          setLocationState("idle");
        }
        return;
      }

      const params = new URLSearchParams({ email: verificationEmail, sent: "1" });
      const next = getSafeLocalRedirect(searchParams.get("next"), "");
      if (next) params.set("next", next);
      router.push(`/verify-email?${params.toString()}`);
    } catch {
      setError("Unable to create your account right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout wide>
      <h1 className="text-[2rem] font-semibold tracking-[-0.035em] text-[var(--color-foreground)] sm:text-[2.2rem]">
        Create your account
      </h1>
      <p className="mt-2 text-sm leading-6 text-[var(--color-muted-foreground)]">
        Create an account to submit and manage flood reports.
      </p>
      <p className="mt-2 text-xs leading-5 text-[var(--color-muted-foreground)]">Your registered full name will appear publicly on reports you submit. Your email and residential address stay private.</p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 grid gap-5">
        <div className="space-y-4">
          <h2 className="border-b border-[var(--color-border)] pb-2 text-sm font-semibold text-[var(--color-foreground)]">Account information</h2>
        <AuthInput id="fullName" label="Full Name" autoComplete="name" required value={fullName}
          onChange={setFullName} onBlur={() => touch("fullName")} error={fullNameError} placeholder="e.g. Juan Dela Cruz" maxLength={80}
          hint="Enter at least your given name and family name." />
        <AuthInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={changeEmail}
          onBlur={() => touch("email")}
          error={emailError}
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
          onBlur={() => touch("password")}
          error={passwordError}
          hint="Use 10–200 characters with letters and a number or symbol."
        />
        <PasswordInput
          id="confirmPassword"
          label="Confirm Password"
          autoComplete="new-password"
          required
          value={confirmPassword}
          onChange={setConfirmPassword}
          onBlur={() => touch("confirmPassword")}
          error={confirmPasswordError}
          hint={confirmPassword && password === confirmPassword ? "Passwords match." : undefined}
        />
        </div>

        <section aria-label="Current address" className="grid gap-4 border-t border-[var(--color-border)] pt-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin aria-hidden="true" className="size-4 text-[var(--color-primary)]" />Location information</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Your device location must be verified in Bulacan. You can add missing street details after detection.</p>
          {location ? <div className="grid gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-panel)] p-4 text-sm leading-5">
            <p className="font-semibold text-[var(--color-foreground)]">{location.cityMunicipality || "Bulacan"}, Bulacan</p>
            <p className="text-[var(--color-muted-foreground)]">{location.fullAddress}</p>
            {location.barangay ? <p className="text-xs text-[var(--color-muted-foreground)]">Barangay {location.barangay}</p> : null}
          </div> : <p className="text-xs text-[var(--color-muted-foreground)]">Your verified address will appear here after detection.</p>}
          {location && !location.streetAddress ? <AuthInput id="streetAddress" label="House number, street or subdivision" optional
            value={streetAddress} onChange={setStreetAddress} maxLength={120}
            hint="Add missing street details only. The verified location stays fixed." /> : null}
          <button type="button" onClick={detectLocation} disabled={locationState === "loading" || !registrationEmail(email)}
            className="flex h-[52px] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] text-sm font-semibold hover:border-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60">
            {locationState === "loading" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <MapPin aria-hidden="true" className="size-4" />}
            {locationState === "loading" ? "Detecting location..." : location ? "Detect My Location Again" : "Detect My Location"}
          </button>
          <div aria-live="polite" role="status" className={`text-xs ${locationState === "verified" ? "text-[var(--color-success-text)]" : ["outside", "denied", "unavailable"].includes(locationState) ? "text-[var(--color-warning-text)]" : "text-[var(--color-muted-foreground)]"}`}>
            {locationState === "verified" ? "Location verified — Bulacan, Philippines." :
              locationState === "outside" ? "Account registration is currently available only within Bulacan. You can still explore flood reports, weather updates, and evacuation information without an account." :
              locationState === "denied" ? "Location access is required to verify registration eligibility. Please enable location permission in your browser and try again." :
              locationState === "unavailable" ? locationMessage ?? "We couldn't verify your location accurately. Please move to an area with a stronger location signal and try again." :
              locationState === "loading" ? "Checking your location and address..." : ""}
          </div>
          {locationState === "outside" ? <Link href="/" className="text-center text-sm font-semibold text-[var(--color-primary)] hover:underline">Continue browsing</Link> : null}
          {locationState === "denied" || locationState === "unavailable" ? <button type="button" onClick={detectLocation} className="text-left text-xs font-medium text-[var(--color-primary)] hover:underline">Try Again</button> : null}
        </section>

        {error ? <AuthAlert title="Unable to create your account" message={error} /> : null}

        <AuthButton loading={submitting} disabled={!location} loadingLabel="Creating account...">
          Create account
        </AuthButton>
      </form>

      <p className="mt-7 text-center text-sm text-[var(--color-muted-foreground)]">
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
