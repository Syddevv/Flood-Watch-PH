"use client";

import Link from "next/link";
import { useState } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { AuthButton } from "@/components/auth/auth-button";
import { AuthInput } from "@/components/auth/auth-input";
import { AuthLayout } from "@/components/auth/auth-layout";
import { useAuthSession } from "@/components/auth-session-provider";
import { normalizeFullName } from "@/lib/registration-policy";

export default function ProfilePage() {
  const { user, isLoading, refresh } = useAuthSession();
  const [fullName, setFullName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const draftName = fullName ?? user?.fullName ?? "";

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setSaving(true);
    try {
      const response = await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: draftName }) });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Unable to update your profile.");
      await refresh();
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to update your profile.");
    } finally {
      setSaving(false);
    }
  }

  return <AuthLayout>
    <h1 className="text-2xl font-semibold">Your profile</h1>
    {isLoading ? <p role="status" className="mt-4 text-sm">Loading profile...</p> : !user ?
      <p className="mt-4 text-sm">Sign in to update your profile. <Link href="/login?next=/profile" className="text-[var(--color-primary)] underline">Log in</Link></p> :
      <form onSubmit={save} className="mt-5 grid gap-4">
        <p className="text-sm text-[var(--color-muted-foreground)]">Your registered full name appears publicly on flood reports. Your email and residential address stay private.</p>
        <AuthInput id="profile-full-name" label="Full Name" autoComplete="name" required maxLength={80} value={draftName} onChange={setFullName} />
        <p className="text-xs text-[var(--color-muted-foreground)]">Registered email: {user.email}</p>
        {error ? <AuthAlert title="Unable to update profile" message={error} /> : null}
        {saved ? <p role="status" className="text-sm text-[var(--color-success-text)]">Profile updated. You can now submit a report.</p> : null}
        <AuthButton disabled={!normalizeFullName(draftName)} loading={saving}>Save profile</AuthButton>
        <Link href="/incident-reports" className="text-center text-sm text-[var(--color-primary)] hover:underline">Back to reports</Link>
      </form>}
  </AuthLayout>;
}
