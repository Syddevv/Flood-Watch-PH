import Link from "next/link";

export function AdminCoveredAreas() {
  return <div className="space-y-5"><header><p className="text-xs font-bold tracking-[.18em] text-[var(--color-primary)]">BULACAN OPERATIONS</p><h2 className="mt-2 text-3xl font-bold">Covered areas</h2></header><section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6"><h3 className="font-semibold">Barangay monitoring feed unavailable</h3><p className="mt-2 max-w-2xl text-sm text-[var(--color-muted-foreground)]">Current water levels, risk ratings, and monitoring coverage have not been connected to verified sources. Earlier preview values have been removed.</p><Link href="/admin/reports" className="mt-4 inline-block rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">View live flood reports</Link></section></div>;
}
