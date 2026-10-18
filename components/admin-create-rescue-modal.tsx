"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { AdminRescueIntakeForm, type CreatedRescue } from "@/components/admin-rescue-intake-form";

export function AdminCreateRescueModal({ onCreated }: { onCreated: (request: CreatedRescue, nearDuplicate: boolean) => void }) {
  const [open, setOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);
  function close() {
    if (dirty && !window.confirm("Discard this unfinished rescue request?")) return;
    setOpen(false); setDirty(false);
    trigger.current?.focus();
  }
  return <>
    <button ref={trigger} type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4" />New rescue</button>
    <dialog ref={dialog} aria-labelledby="admin-rescue-modal-title" onCancel={(event) => { event.preventDefault(); close(); }} className="fixed inset-0 m-auto max-h-[min(90dvh,900px)] w-[min(94vw,760px)] overflow-y-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-black/65">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5"><h2 id="admin-rescue-modal-title" className="text-xl font-semibold">New rescue request</h2><button type="button" onClick={close} aria-label="Close new rescue request" className="rounded-lg p-2 hover:bg-[var(--color-panel)]"><X className="h-5 w-5" /></button></div>
      <div className="p-4 sm:p-5">{open && <AdminRescueIntakeForm onDirtyChange={setDirty} onCancel={close} onCreated={(request, nearDuplicate) => { setDirty(false); setOpen(false); trigger.current?.focus(); onCreated(request, nearDuplicate); }} />}</div>
    </dialog>
  </>;
}
