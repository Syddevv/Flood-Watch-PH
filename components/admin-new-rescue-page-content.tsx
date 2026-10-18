"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminRescueIntakeForm } from "@/components/admin-rescue-intake-form";

export function AdminNewRescuePageContent() {
  const [dirty, setDirty] = useState(false);
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    const confirmLink = (event: globalThis.MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest("a[href]");
      if (link instanceof HTMLAnchorElement && link.target !== "_blank" && !window.confirm("Discard this unfinished rescue request?")) {
        event.preventDefault(); event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", confirmLink, true);
    return () => { window.removeEventListener("beforeunload", beforeUnload); document.removeEventListener("click", confirmLink, true); };
  }, [dirty]);
  return <div className="mx-auto max-w-3xl space-y-5"><Link href="/admin/rescue-requests" className="text-sm underline">← Rescue requests</Link><div><h2 className="text-2xl font-semibold">New rescue request</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">For phone, walk-in, or other assisted intake.</p></div>{success ? <p role="status" className="rounded-lg border border-[var(--color-success-border)] p-4 text-sm">{success} <Link href="/admin/rescue-requests" className="underline">View recent requests</Link></p> : <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6"><AdminRescueIntakeForm onDirtyChange={setDirty} onCreated={(request, nearDuplicate) => { setDirty(false); setSuccess(`${request.reference} recorded. This does not confirm dispatch.${nearDuplicate ? " A similar recent request may exist; review before acting." : ""}`); }} /></section>}</div>;
}
