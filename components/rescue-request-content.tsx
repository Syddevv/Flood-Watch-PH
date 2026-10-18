"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { useAuthSession } from "@/components/auth-session-provider";
import { RescueRequestAside } from "@/components/rescue-request-aside";
import { RescueRequestCard } from "@/components/rescue-request-card";
import { RescueRequestForm } from "@/components/rescue-request-form";
import { rescueApi, shouldPollRescue, type RescueRecord } from "@/lib/rescue-request-client";
import { serializeRescueSubmission, type RescueRequestSubmission } from "@/lib/rescue-request-form";

type ListResult = { requests: RescueRecord[]; nextCursor: string | null };
type CreateResult = { request: RescueRecord; replayed: boolean; nearDuplicate: boolean };

export function RescueRequestContent() {
  const { user, isLoading: authLoading } = useAuthSession();
  const [requests, setRequests] = useState<RescueRecord[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const retryRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const nextCursorRef = useRef<string | null>(null);
  const busyRef = useRef(false);

  const refresh = useCallback(async (append = false) => {
    if (!user || busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    try {
      const cursor = append ? nextCursorRef.current : null;
      const data = await rescueApi<ListResult>(`/api/rescue-requests?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`);
      setRequests((current) => append ? [...current, ...data.requests.filter((item) => !current.some((known) => known.id === item.id))] : [
        ...data.requests, ...current.filter((item) => !data.requests.some((fresh) => fresh.id === item.id)),
      ]);
      setNextCursor(data.nextCursor);
      nextCursorRef.current = data.nextCursor;
      setLastChecked(new Date());
      setStale(false);
      setError(null);
    } catch (cause) {
      setStale(true);
      setError(cause instanceof Error ? cause.message : "Unable to refresh requests.");
    } finally { busyRef.current = false; setLoading(false); }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [user, refresh]);

  useEffect(() => {
    if (!user || !shouldPollRescue(requests)) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); }, 30_000);
    const onResume = () => { if (document.visibilityState === "visible" && navigator.onLine) void refresh(); };
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", onResume); window.removeEventListener("online", onResume); document.removeEventListener("visibilitychange", onResume); };
  }, [user, requests, refresh]);

  async function handleSubmit(submission: RescueRequestSubmission) {
    const body = serializeRescueSubmission(submission);
    const fingerprint = JSON.stringify(body);
    if (retryRef.current?.fingerprint !== fingerprint) retryRef.current = { fingerprint, key: crypto.randomUUID() };
    const result = await rescueApi<CreateResult>("/api/rescue-requests", {
      method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": retryRef.current.key }, body: fingerprint,
    });
    retryRef.current = null;
    setSuccess(`${result.request.reference} received. This confirms a request was recorded, not that a team was dispatched.${result.nearDuplicate ? " A similar recent request may exist; check your history." : ""}`);
    setRequests((current) => [result.request, ...current.filter((item) => item.id !== result.request.id)]);
    void refresh();
    return true;
  }

  return <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
    <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-6 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-7 md:py-7 xl:px-10">
      <header className="border-b border-[var(--color-border)] pb-5">
        <h1 className="text-3xl font-semibold">Request Rescue Assistance</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--color-muted-foreground)]">If life is in immediate danger, call 911. Filing here creates a request but does not guarantee dispatch or a response.</p>
      </header>
      <section className="flex items-start gap-3 rounded-xl border border-[var(--color-info-border)] bg-[var(--color-info-surface)] p-4">
        <LifeBuoy className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm leading-6">Give your best location and a reachable number. You can describe the place if GPS or the camera is unavailable.</p>
      </section>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <main className="min-w-0 space-y-6">
          {success ? <p role="status" data-testid="rescue-success" className="rounded-lg border border-[var(--color-success-border)] bg-[var(--color-success-surface)] p-3 text-sm">{success}</p> : null}
          <RescueRequestForm signedIn={Boolean(user)} authLoading={authLoading} onSubmit={handleSubmit} />
          <section aria-label="My rescue requests">
            <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-xl font-semibold">My Rescue Requests</h2><span data-testid="rescue-request-count" className="text-sm text-[var(--color-muted-foreground)]">{requests.length} requests</span></div>
            {stale ? <p role="status" className="mt-3 rounded-lg border border-[var(--color-warning)] p-3 text-sm">Could not refresh. Showing last known information{lastChecked ? ` from ${lastChecked.toLocaleString("en-PH")}` : ""}. <button type="button" onClick={() => void refresh()} className="underline">Try again</button></p> : null}
            {error && requests.length === 0 ? <p role="alert" className="mt-3 text-sm text-[var(--color-danger)]">{error}</p> : null}
            {!user && !authLoading ? <p className="mt-3 text-sm">Sign in to see your requests.</p> : null}
            {user && !loading && !error && requests.length === 0 ? <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">No rescue requests yet.</p> : null}
            <div className="mt-3 space-y-3">{requests.map((request) => <RescueRequestCard key={request.id} request={request} />)}</div>
            {nextCursor ? <button type="button" disabled={loading} onClick={() => void refresh(true)} className="mt-4 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">{loading ? "Loading…" : "Load more"}</button> : null}
          </section>
        </main>
        <aside className="min-w-0 lg:sticky lg:top-5"><RescueRequestAside /></aside>
      </div>
    </div>
  </div>;
}
