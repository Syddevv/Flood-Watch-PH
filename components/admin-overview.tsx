import Link from "next/link";

export function AdminOverview() {
  return <div className="space-y-6">
    <header><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold">Operations overview</h2><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Use the live, protected worklists below. Unconnected operational feeds are not shown as current activity.</p></header>
    <div className="grid gap-4 md:grid-cols-2">
      <Link href="/admin/rescue-requests" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]"><h3 className="text-lg font-semibold">Rescue requests</h3><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">View the live queue, triage, case owners, and confirmed dispatch events.</p></Link>
      <Link href="/admin/reports" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]"><h3 className="text-lg font-semibold">Flood reports</h3><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Review current resident reports and evidence.</p></Link>
      <Link href="/admin/data" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]"><h3 className="text-lg font-semibold">Evacuation centers</h3><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Review center listings and separately confirmed opening status.</p></Link>
      <Link href="/admin/notifications" className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5 hover:border-[var(--color-primary)]"><h3 className="text-lg font-semibold">Notifications</h3><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">See persisted in-app notices for new rescue requests.</p></Link>
    </div>
    <section className="rounded-xl border border-[var(--color-warning-border)] p-5"><h3 className="font-semibold">Operational feeds unavailable</h3><p className="mt-2 text-sm text-[var(--color-muted-foreground)]">Live rainfall alerts, shelter occupancy, responder tracking, and combined activity metrics are not connected. No preview numbers or fictional events are displayed.</p></section>
  </div>;
}
