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
  const [fullName, setFullName] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [location, setLocation] = useState<{ token: string; fullAddress: string; streetAddress: string | null; barangay: string | null; cityMunicipality: string | null; postalCode: string | null } | null>(null);
  const [locationState, setLocationState] = useState<"idle" | "loading" | "verified" | "outside" | "denied" | "unavailable">("idle");
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const locationRequest = useRef(0);

  function changeEmail(value: string) {
    locationRequest.current += 1;
    setEmail(value);
    setLocation(null);
    setLocationState("idle");
  }

  function detectLocation() {
    const requestId = ++locationRequest.current;
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
    if (submitting || !location || !normalizeFullName(fullName) || !registrationEmail(email) || !isValidRegistrationPassword(password)) return;
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
    <AuthLayout>
      <h1 className="text-[1.7rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)] sm:text-[1.85rem]">
        Create your account
      </h1>
      <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
        Create an account to submit and manage flood reports.
      </p>

      <form onSubmit={handleSubmit} noValidate className="mt-7 grid gap-4">
        <AuthInput id="fullName" label="Full Name" autoComplete="name" required value={fullName}
          onChange={setFullName} placeholder="e.g. Juan Dela Cruz" maxLength={80}
          hint="Enter at least your given name and family name." />
        <AuthInput
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={changeEmail}
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
          hint="Use 10–200 characters with letters and a number or symbol."
        />

        <section aria-label="Current address" className="grid gap-3 rounded-lg border border-[var(--color-border)] p-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold"><MapPin aria-hidden="true" className="size-4" />Current Address</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">Your device location must be verified in Bulacan. You can add missing street details after detection.</p>
          {location ? <div className="grid gap-1 text-xs leading-5 text-[var(--color-muted-foreground)]">
            <p>Street: {location.streetAddress || streetAddress || "Unavailable"}</p>
            <p>Barangay: {location.barangay || "Unavailable"}</p>
            <p>City or municipality: {location.cityMunicipality || "Unavailable"}</p>
            <p>Province: Bulacan · Postal code: {location.postalCode || "Unavailable"}</p>
            <p>Country: Philippines</p>
          </div> : <p className="text-xs text-[var(--color-muted-foreground)]">Address unavailable until location is detected.</p>}
          {location && !location.streetAddress ? <AuthInput id="streetAddress" label="House number, street or subdivision" optional
            value={streetAddress} onChange={setStreetAddress} maxLength={120}
            hint="Add missing street details only. The verified location stays fixed." /> : null}
          <button type="button" onClick={detectLocation} disabled={locationState === "loading" || !registrationEmail(email)}
            className="flex h-10 items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[var(--color-border)] text-sm font-medium hover:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60">
            {locationState === "loading" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <MapPin aria-hidden="true" className="size-4" />}
            {locationState === "loading" ? "Detecting location..." : location ? "Detect My Location Again" : "Detect My Location"}
          </button>
          <div aria-live="polite" role="status" className={`text-xs ${locationState === "verified" ? "text-[var(--color-success-text)]" : ["outside", "denied", "unavailable"].includes(locationState) ? "text-[var(--color-warning-text)]" : "text-[var(--color-muted-foreground)]"}`}>
            {locationState === "verified" ? "Location verified — Bulacan, Philippines." :
              locationState === "outside" ? "Registration is currently available only to residents registering from within Bulacan. Your current location appears to be outside our supported area." :
              locationState === "denied" ? "Location access is required to verify registration eligibility. Please enable location permission in your browser and try again." :
              locationState === "unavailable" ? locationMessage ?? "We couldn't verify your location accurately. Please move to an area with a stronger location signal and try again." :
              locationState === "loading" ? "Checking your location and address..." : ""}
          </div>
          {locationState === "outside" ? <><p className="text-xs text-[var(--color-muted-foreground)]">You can still explore Flood Watch, view flood reports, check weather conditions, and find evacuation centers without an account.</p><Link href="/" className="text-center text-sm font-medium text-[var(--color-primary)] hover:underline">Continue as Guest</Link></> : null}
          {locationState === "denied" || locationState === "unavailable" ? <button type="button" onClick={detectLocation} className="text-left text-xs font-medium text-[var(--color-primary)] hover:underline">Try Again</button> : null}
        </section>

        {error ? <AuthAlert title="Unable to create your account" message={error} /> : null}

        <AuthButton loading={submitting} disabled={!location || !normalizeFullName(fullName) || !registrationEmail(email) || !isValidRegistrationPassword(password)} loadingLabel="Creating account...">
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
