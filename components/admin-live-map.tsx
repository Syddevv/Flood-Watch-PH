import Link from "next/link";

export function AdminLiveMap() {
  return <div className="space-y-5"><header><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold">Operations map</h2></header><section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><h3 className="font-semibold">Live operational map unavailable</h3><p className="mt-2 max-w-2xl text-sm text-[var(--color-muted-foreground)]">An authorized operational map feed is not connected yet. Review the existing flood report worklist for current records.</p><div className="mt-4 flex flex-wrap gap-3"><Link href="/admin/reports" className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Flood reports</Link></div></section></div>;
}
