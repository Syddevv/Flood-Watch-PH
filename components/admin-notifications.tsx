"use client";

import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { useMemo, useState } from "react";

type NotificationItem = {
  id: string;
  title: string;
  detail: string;
  age: string;
  href: string;
  unread: boolean;
};

const initialNotifications: NotificationItem[] = [
  {
    id: "rescue-request",
    title: "Critical rescue request submitted",
    detail: "RR-1048 · Brgy. Meysulao",
    age: "2 min",
    href: "/admin/rescue-requests",
    unread: true,
  },
  {
    id: "verification-threshold",
    title: "Report has reached verification threshold",
    detail: "RPT-5821 · Brgy. Poblacion",
    age: "7 min",
    href: "/admin/reports",
    unread: true,
  },
  {
    id: "center-capacity",
    title: "Gatbuca Covered Court is full",
    detail: "180 of 180 capacity",
    age: "18 min",
    href: "/admin/data",
    unread: true,
  },
  {
    id: "rainfall-advisory",
    title: "PAGASA rainfall advisory updated",
    detail: "Orange rainfall warning remains active",
    age: "26 min",
    href: "/admin",
    unread: false,
  },
];

function publishUnreadCount(notifications: NotificationItem[]) {
  const count = notifications.filter((notification) => notification.unread).length;
  window.dispatchEvent(new CustomEvent<number>("floodwatch:notification-count", { detail: count }));
}

export function AdminNotifications() {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const visibleNotifications = useMemo(
    () => unreadOnly ? notifications.filter((notification) => notification.unread) : notifications,
    [notifications, unreadOnly],
  );
  const unreadCount = notifications.filter((notification) => notification.unread).length;

  function markAllRead() {
    const updated = notifications.map((notification) => ({ ...notification, unread: false }));
    setNotifications(updated);
    publishUnreadCount(updated);
  }

  function markRead(id: string) {
    const updated = notifications.map((notification) => notification.id === id ? { ...notification, unread: false } : notification);
    setNotifications(updated);
    publishUnreadCount(updated);
  }

  return (
    <div className="min-h-[calc(100vh-8rem)]">
      <header className="flex flex-col gap-4 border-b border-[var(--color-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold tracking-[.14em] text-[var(--color-primary)]">CALUMPIT EMERGENCY OPERATIONS</p>
          <h2 className="mt-1 text-3xl font-bold">Notifications</h2>
          <p className="mt-1 text-sm text-blue-300">Operational alerts and system updates linked to relevant records.</p>
        </div>
        <button type="button" onClick={markAllRead} disabled={unreadCount === 0} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3 text-sm font-semibold hover:bg-[var(--color-panel)] disabled:cursor-default disabled:opacity-50 sm:self-auto">
          <CheckCircle2 className="h-4 w-4" />
          Mark all read
        </button>
      </header>

      <div className="mx-auto mt-6 max-w-[848px]">
        <div className="mb-4 flex justify-end">
          <label className="flex cursor-pointer items-center gap-3 text-sm font-semibold">
            <button type="button" role="switch" aria-checked={unreadOnly} onClick={() => setUnreadOnly((current) => !current)} className={`relative h-[18px] w-8 shrink-0 rounded-full transition-colors ${unreadOnly ? "bg-[var(--color-primary)]" : "bg-slate-500/70"}`}>
              <span className={`absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform ${unreadOnly ? "translate-x-3.5" : "translate-x-0"}`} />
              <span className="sr-only">Show unread notifications only</span>
            </button>
            Unread only
          </label>
        </div>

        <div className="space-y-4">
          {visibleNotifications.map((notification) => (
            <Link key={notification.id} href={notification.href} onClick={() => markRead(notification.id)} className={`grid min-h-[126px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-4 rounded-[14px] border bg-[var(--color-surface)] px-6 py-5 transition hover:bg-[var(--color-panel)] sm:px-7 ${notification.unread ? "border-blue-400/50" : "border-[var(--color-border)]"}`}>
              <Bell className="h-4 w-4 text-slate-200" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{notification.title}</h3>
                  {notification.unread && <span className="rounded-lg bg-blue-500 px-2 py-1 text-xs font-semibold text-white">New</span>}
                </div>
                <p className="mt-1 text-sm text-blue-300">{notification.detail}</p>
              </div>
              <time className="self-start pt-4 text-xs text-blue-300 sm:self-center sm:pt-0">{notification.age}</time>
            </Link>
          ))}

          {visibleNotifications.length === 0 && (
            <div className="grid min-h-48 place-items-center rounded-[14px] border border-dashed border-[var(--color-border)] text-center">
              <div>
                <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-400" />
                <p className="mt-3 font-semibold">You are all caught up</p>
                <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">There are no unread notifications.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
