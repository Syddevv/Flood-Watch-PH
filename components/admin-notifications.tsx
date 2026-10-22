"use client";

import { Bell, CheckCircle2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Notification = { id: string; title: string; detail: string; targetType: string | null; targetId: string | null; readAt: string | null; createdAt: string };
type Payload = { notifications: Notification[]; unreadCount: number };
type Envelope = { data?: Payload | { unreadCount: number }; error?: string };

export function AdminNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/notifications", { cache: "no-store" });
      const body = await response.json() as Envelope;
      if (!response.ok || !body.data || !("notifications" in body.data)) throw new Error(body.error ?? "Could not load notifications.");
      setNotifications(body.data.notifications);
      setUnreadCount(body.data.unreadCount);
      window.dispatchEvent(new CustomEvent<number>("floodwatch:notification-count", { detail: body.data.unreadCount }));
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load notifications."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  async function markRead(id?: string) {
    try {
      const response = await fetch("/api/admin/notifications", { method: "PATCH", headers: { "Content-Type": "application/json", Origin: window.location.origin }, body: JSON.stringify(id ? { id } : { all: true }) });
      const body = await response.json() as Envelope;
      if (!response.ok || !body.data) throw new Error(body.error ?? "Could not mark notification read.");
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not mark notification read."); }
  }

  const visible = unreadOnly ? notifications.filter((item) => !item.readAt) : notifications;
  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[.14em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-1 text-3xl font-bold">Notifications</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Persisted in-app notices. No SMS or external paging is connected.</p></div><button type="button" onClick={() => void markRead()} disabled={!unreadCount} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm disabled:opacity-50"><CheckCircle2 className="mr-2 inline h-4 w-4" />Mark all read</button></header>
    {error && <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] p-3 text-sm">{error} <button onClick={() => void load()} className="underline">Retry</button></p>}
    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={unreadOnly} onChange={(event) => setUnreadOnly(event.target.checked)} />Unread only</label>
    {loading && !notifications.length && <p role="status">Loading notifications…</p>}
    {!loading && !visible.length && <p className="rounded-xl border border-[var(--color-border)] p-6 text-sm">No {unreadOnly ? "unread " : ""}notifications.</p>}
    <ul className="space-y-3">{visible.map((item) => <li key={item.id} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4"><div className="flex items-start gap-3"><Bell className="mt-1 h-4 w-4 shrink-0" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.title}</h3>{!item.readAt && <span className="rounded bg-[var(--color-primary)] px-2 py-0.5 text-xs text-white">New</span>}</div><p className="mt-1 text-sm">{item.detail}</p><time className="mt-1 block text-xs text-[var(--color-muted-foreground)]">{new Date(item.createdAt).toLocaleString("en-PH")}</time><div className="mt-3 flex flex-wrap gap-3">{!item.readAt && <button type="button" onClick={() => void markRead(item.id)} className="text-sm underline">Mark read</button>}</div></div></div></li>)}</ul>
  </div>;
}
