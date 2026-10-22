"use client";

import { MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { AdminCenter } from "@/components/admin-evacuation-centers-page";
import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import { CENTER_FACILITIES, CENTER_SOURCE_TYPES, CENTER_STATUSES, CENTER_VERIFICATION_STATUSES } from "@/lib/admin-evacuation";
import { currentCenterOpeningStatus } from "@/lib/emergency-resources";
import { formatUiLabel } from "@/lib/ui-labels";

type Draft = {
  name: string; description: string; address: string; barangay: string; city: string;
  latitude: string; longitude: string; contactNumber: string; facilities: string[];
  status: string; verificationStatus: string; sourceType: string; sourceName: string;
  sourceUrl: string; lastVerifiedAt: string; notes: string; estimatedCapacity: string;
  sourceCheckedAt: string; facilityType: string; permanent: string;
  adminEvidenceUrl: string; duplicateReviewNotes: string; confirmAvailability: boolean;
  operationalConfirmedAt: string; operationalEvidenceUrl: string; directConfirmationNote: string;
};
type TextKey = Exclude<keyof Draft, "facilities" | "confirmAvailability">;
type Props = {
  centerId?: string;
  onClose: () => void;
  onSaved: (center: AdminCenter, created: boolean) => void;
  onArchived: (center: AdminCenter) => void;
};

const facilityTypes = [
  "barangay_evacuation_center", "barangay_hall", "barangay_outpost", "chapel",
  "covered_court", "dedicated_evacuation_center", "designated_evacuation_facility",
  "evacuation_center_compound", "gymnasium", "multipurpose_evacuation_center",
  "municipal_evacuation_center", "municipal_hall", "school", "sports_facility", "unspecified",
];
const operationalStatuses = new Set<string>(["available", "closed", "full", "temporarily_unavailable"]);
const fieldClass = "h-10 w-full min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-panel)] px-3 text-sm text-[var(--color-foreground)] outline-none focus:border-[var(--color-primary)] focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/25 aria-invalid:border-[var(--color-danger)]";
const labelClass = "grid min-w-0 gap-1.5 text-sm font-medium text-[var(--color-muted-foreground)]";

const emptyDraft: Draft = {
  name: "", description: "", address: "", barangay: "", city: "", latitude: "", longitude: "",
  contactNumber: "", facilities: [], status: "needs_verification", verificationStatus: "needs_verification",
  sourceType: "official_lgu", sourceName: "", sourceUrl: "", lastVerifiedAt: "", notes: "",
  estimatedCapacity: "", sourceCheckedAt: "", facilityType: "", permanent: "",
  adminEvidenceUrl: "", duplicateReviewNotes: "", confirmAvailability: false,
  operationalConfirmedAt: "", operationalEvidenceUrl: "", directConfirmationNote: "",
};

function manilaDateInput(value: string | null) {
  if (!value) return "";
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? new Date(time + 8 * 60 * 60 * 1000).toISOString().slice(0, 10) : "";
}

function fromCenter(center: AdminCenter): Draft {
  return {
    name: center.name, description: center.description ?? "", address: center.address,
    barangay: center.barangay ?? "", city: center.city,
    latitude: center.latitude?.toString() ?? "", longitude: center.longitude?.toString() ?? "",
    contactNumber: center.contactNumber ?? "", facilities: center.facilities,
    status: center.status, verificationStatus: center.verificationStatus,
    sourceType: center.sourceType, sourceName: center.sourceName ?? "", sourceUrl: center.sourceUrl ?? "",
    lastVerifiedAt: manilaDateInput(center.lastVerifiedAt), notes: center.notes ?? "",
    estimatedCapacity: center.estimatedCapacity == null ? "" : String(center.estimatedCapacity),
    sourceCheckedAt: manilaDateInput(center.sourceCheckedAt), facilityType: center.facilityType ?? "",
    permanent: center.permanent == null ? "" : String(center.permanent),
    adminEvidenceUrl: center.adminEvidenceUrl ?? "", duplicateReviewNotes: center.duplicateReviewNotes ?? "",
    confirmAvailability: false, operationalConfirmedAt: "", operationalEvidenceUrl: "", directConfirmationNote: "",
  };
}

function labelFor(value: string) {
  if (value === "available") return "Open (requires current confirmation)";
  if (value === "true") return "Yes";
  if (value === "false") return "No";
  if (value === "official_lgu") return "Official LGU";
  if (value === "official_dswd") return "Official DSWD";
  if (value === "openstreetmap") return "OpenStreetMap";
  return formatUiLabel(value).replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function checkedDateIsFutureOrInvalid(value: string) {
  const time = new Date(`${value}T00:00:00+08:00`).getTime();
  return !Number.isFinite(time) || time > Date.now();
}

export function AdminEvacuationCenterDialog({ centerId, onClose, onSaved, onArchived }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const mapRef = useRef<HTMLDetailsElement>(null);
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const [center, setCenter] = useState<AdminCenter | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [initialDraft, setInitialDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(centerId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    fetch(`/api/admin/evacuation-centers/${encodeURIComponent(centerId)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load center.");
        const loaded = payload.data.center as AdminCenter;
        const nextDraft = fromCenter(loaded);
        setCenter(loaded);
        setDraft(nextDraft);
        setInitialDraft(nextDraft);
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load center."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [centerId]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  function requestClose() {
    if (saving) return;
    if (dirty && !window.confirm("Discard your unsaved center changes?")) return;
    onClose();
  }

  function validate() {
    const next: Record<string, string> = {};
    if (!draft.name.trim()) next.name = "Enter a center name.";
    if (!draft.address.trim()) next.address = "Enter a complete address.";
    if (!BULACAN_LOCALITIES.some((locality) => locality.name === draft.city)) next.city = "Choose a Bulacan municipality or city.";
    if (draft.estimatedCapacity && (!Number.isSafeInteger(Number(draft.estimatedCapacity)) || Number(draft.estimatedCapacity) < 0)) next.estimatedCapacity = "Enter a non-negative whole number.";
    if (Boolean(draft.latitude) !== Boolean(draft.longitude) || (draft.latitude && (!Number.isFinite(Number(draft.latitude)) || !Number.isFinite(Number(draft.longitude))))) next.latitude = "Enter both valid coordinates or leave both blank.";
    for (const key of ["sourceUrl", "adminEvidenceUrl", "operationalEvidenceUrl"] as const) {
      if (draft[key] && !/^https:\/\/[^\s]+$/i.test(draft[key])) next[key] = "Enter an HTTPS URL.";
    }
    if (draft.lastVerifiedAt && checkedDateIsFutureOrInvalid(draft.lastVerifiedAt)) next.lastVerifiedAt = "Choose a valid checked date that is not in the future.";
    if (draft.sourceCheckedAt && checkedDateIsFutureOrInvalid(draft.sourceCheckedAt)) next.sourceCheckedAt = "Choose a valid research date that is not in the future.";
    if (draft.verificationStatus === "verified" && (!draft.sourceUrl || !draft.lastVerifiedAt || !draft.latitude || !["official_dswd", "official_lgu", "official_government"].includes(draft.sourceType))) next.verificationStatus = "Verified identity requires an official source, checked date, and exact coordinates.";
    if (draft.verificationStatus === "official_publication_found" && (!draft.sourceUrl || !draft.sourceCheckedAt)) next.verificationStatus = "An official publication needs its source URL and research date.";
    const operationalChange = operationalStatuses.has(draft.status) && draft.status !== center?.status;
    if (operationalChange && !draft.confirmAvailability) next.status = "Confirm this operational change with current evidence.";
    if (draft.confirmAvailability) {
      if (!operationalStatuses.has(draft.status)) next.status = "Only Open, Closed, Full, or Temporarily Unavailable can be confirmed.";
      if (!draft.operationalConfirmedAt || Number.isNaN(new Date(draft.operationalConfirmedAt).getTime()) || new Date(draft.operationalConfirmedAt).getTime() > Date.now()) next.operationalConfirmedAt = "Enter a valid confirmation time that is not in the future.";
      if (!draft.operationalEvidenceUrl && draft.directConfirmationNote.trim().length < 10) next.operationalEvidenceUrl = "Add an official announcement or document direct confirmation.";
    }
    setFieldErrors(next);
    if (next.latitude && mapRef.current) mapRef.current.open = true;
    if ((next.sourceUrl || next.adminEvidenceUrl || next.lastVerifiedAt || next.sourceCheckedAt || next.verificationStatus) && advancedRef.current) advancedRef.current.open = true;
    if (Object.keys(next).length) {
      setError("Review the highlighted fields and try again.");
      requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.scrollIntoView({ block: "center" }));
    }
    return Object.keys(next).length === 0;
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving || loading || !validate()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(centerId ? `/api/admin/evacuation-centers/${encodeURIComponent(centerId)}` : "/api/admin/evacuation-centers", {
        method: centerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft, localityCode: BULACAN_LOCALITIES.find((locality) => locality.name === draft.city)?.code,
          province: "Bulacan", region: "Region III",
          latitude: draft.latitude ? Number(draft.latitude) : null,
          longitude: draft.longitude ? Number(draft.longitude) : null,
          estimatedCapacity: draft.estimatedCapacity === "" ? null : Number(draft.estimatedCapacity),
          permanent: draft.permanent === "" ? null : draft.permanent === "true",
          sourceCheckedAt: draft.sourceCheckedAt ? new Date(`${draft.sourceCheckedAt}T00:00:00+08:00`).toISOString() : null,
          lastVerifiedAt: draft.lastVerifiedAt ? new Date(`${draft.lastVerifiedAt}T00:00:00+08:00`).toISOString() : null,
          expectedUpdatedAt: center?.updatedAt,
          operationalConfirmedAt: draft.confirmAvailability && draft.operationalConfirmedAt ? new Date(draft.operationalConfirmedAt).toISOString() : null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to save center.");
      onSaved(payload.data.center as AdminCenter, !centerId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save center.");
    } finally { setSaving(false); }
  }

  async function toggleArchive() {
    if (!center || saving) return;
    const action = center.isArchived ? "restore" : "archive";
    const warning = dirty ? " Unsaved edits will be lost." : "";
    if (!window.confirm(`${center.isArchived ? "Restore" : "Archive"} ${center.name}?${warning}`)) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/evacuation-centers/${encodeURIComponent(center.id)}/${action}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: center.updatedAt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `Unable to ${action} center.`);
      onArchived(payload.data.center as AdminCenter);
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Unable to ${action} center.`); }
    finally { setSaving(false); }
  }

  const input = (label: string, key: TextKey, type = "text", placeholder?: string) => <label className={labelClass}>
    <span>{label}</span>
    <input className={fieldClass} type={type} step={key === "latitude" || key === "longitude" ? "any" : undefined} min={key === "estimatedCapacity" ? 0 : undefined} value={draft[key]} placeholder={placeholder} onChange={(event) => set(key, event.target.value)} aria-invalid={Boolean(fieldErrors[key])} />
    {fieldErrors[key] ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors[key]}</span> : null}
  </label>;
  const select = (label: string, key: TextKey, options: readonly string[], emptyLabel = "Select") => <label className={labelClass}>
    <span>{label}</span>
    <select className={fieldClass} value={draft[key]} onChange={(event) => {
      const value = event.target.value;
      set(key, value);
      if (key === "status") set("confirmAvailability", operationalStatuses.has(value) && value !== center?.status);
    }} aria-invalid={Boolean(fieldErrors[key])}>
      <option value="">{emptyLabel}</option>
      {options.map((option) => <option key={option} value={option}>{labelFor(option)}</option>)}
    </select>
    {fieldErrors[key] ? <span className="text-xs text-[var(--color-danger)]">{fieldErrors[key]}</span> : null}
  </label>;
  const facilityOptions = draft.facilityType && !facilityTypes.includes(draft.facilityType) ? [...facilityTypes, draft.facilityType] : facilityTypes;

  return <dialog ref={dialogRef} aria-labelledby="center-dialog-title" onCancel={(event) => { event.preventDefault(); requestClose(); }} onClick={(event) => { if (event.target === dialogRef.current) requestClose(); }} className="m-auto max-h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] max-w-[44rem] overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-sidebar)] p-0 text-[var(--color-foreground)] shadow-2xl backdrop:bg-black/70 sm:max-h-[90dvh]">
    <form onSubmit={save} noValidate className="flex max-h-[calc(100dvh-1rem)] min-h-0 flex-col sm:max-h-[90dvh]">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-[var(--color-border)] px-5 py-4 sm:px-6">
        <div className="min-w-0"><h2 id="center-dialog-title" className="text-lg font-semibold">{centerId ? "Edit Evacuation Center" : "Add Evacuation Center"}</h2>{center ? <p className="mt-1 truncate text-xs text-[var(--color-muted-foreground)]">{center.name}</p> : null}</div>
        <button type="button" aria-label="Close editor" disabled={saving} onClick={requestClose} className="rounded p-1 text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] disabled:opacity-50"><X aria-hidden="true" className="h-5 w-5" /></button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
        {loading ? <p role="status" className="text-sm">Loading center…</p> : <>
          {error ? <p role="alert" className="rounded-lg border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-3 py-2 text-sm text-[var(--color-danger-text)]">{error}</p> : null}
          {centerId && !center ? <button type="button" onClick={requestClose} className="text-sm text-[var(--color-primary)]">Back to centers</button> : <>
            <section className="space-y-3" aria-label="Center information">
              {input("Center Name", "name")}
              <div className="grid gap-3 sm:grid-cols-2">
                {select("Municipality / City", "city", BULACAN_LOCALITIES.map((locality) => locality.name))}
                {input("Barangay", "barangay", "text", "Enter barangay")}
              </div>
              {input("Complete Address", "address")}
              <div className="grid gap-3 sm:grid-cols-2">
                {select("Facility Type", "facilityType", facilityOptions, "Not recorded")}
                {input("Estimated Capacity", "estimatedCapacity", "number", "Not recorded")}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {input("Contact Number", "contactNumber", "tel", "Optional")}
                {select("Permanent Facility", "permanent", ["true", "false"], "Not recorded")}
              </div>
            </section>

            <section className="space-y-3 border-t border-[var(--color-border)] pt-4" aria-label="Verification and status">
              <div className="grid gap-3 sm:grid-cols-2">
                {select("Facility Verification", "verificationStatus", CENTER_VERIFICATION_STATUSES)}
                {select("Operational Status", "status", CENTER_STATUSES)}
              </div>
              {center && currentCenterOpeningStatus(center.status, center.availabilityConfirmedAt) === "unknown" ? <p className="text-xs text-[var(--color-muted-foreground)]">Current opening is unconfirmed.</p> : null}
              {operationalStatuses.has(draft.status) ? <label className="flex items-start gap-2 text-xs text-[var(--color-muted-foreground)]"><input type="checkbox" className="mt-0.5" checked={draft.confirmAvailability} onChange={(event) => set("confirmAvailability", event.target.checked)} />Record a current operational confirmation</label> : null}
              {draft.confirmAvailability ? <div className="grid gap-3 rounded-lg border border-[var(--color-border)] p-3 sm:grid-cols-2">
                {input("Confirmed At", "operationalConfirmedAt", "datetime-local")}
                {input("Official Announcement URL", "operationalEvidenceUrl", "url")}
                <div className="sm:col-span-2">{input("Or Direct Confirmation Details", "directConfirmationNote", "text", "Authority, method, and details")}</div>
                <p className="text-xs text-[var(--color-muted-foreground)] sm:col-span-2">An official announcement or documented direct confirmation is required.</p>
              </div> : null}
            </section>

            <details ref={mapRef} className="rounded-lg border border-[var(--color-border)] px-3 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold [&::-webkit-details-marker]:hidden"><span className="flex items-center gap-2"><MapPin aria-hidden="true" className="h-4 w-4" />Map Location</span>{draft.latitude && draft.longitude ? <span className="text-xs font-normal text-[var(--color-muted-foreground)]">Location available</span> : null}</summary>
              <p className="mt-3 text-xs text-[var(--color-muted-foreground)]">Exact coordinates are required to display this center on the map.</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">{input("Latitude", "latitude", "number")}{input("Longitude", "longitude", "number")}</div>
            </details>

            <details ref={advancedRef} className="rounded-lg border border-[var(--color-border)] px-3 py-3">
              <summary className="cursor-pointer text-sm font-semibold">Advanced: Sources &amp; Verification</summary>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {select("Source Type", "sourceType", CENTER_SOURCE_TYPES)}
                {input("Source Name", "sourceName")}
                <div className="sm:col-span-2">{input("Official Source URL", "sourceUrl", "url")}</div>
                {input("Last Checked Date", "lastVerifiedAt", "date")}
                {input("Source Researched Date", "sourceCheckedAt", "date")}
                <div className="sm:col-span-2">{input("Correction Evidence URL", "adminEvidenceUrl", "url")}</div>
                {input("Internal Note", "notes")}
                {input("Duplicate Review Notes", "duplicateReviewNotes")}
                <div className="sm:col-span-2">{input("Description", "description")}</div>
              </div>
              <fieldset className="mt-4"><legend className="text-sm font-medium">Facilities</legend><div className="mt-2 flex flex-wrap gap-3">{CENTER_FACILITIES.map((facility) => <label key={facility} className="flex items-center gap-1 text-xs"><input type="checkbox" checked={draft.facilities.includes(facility)} onChange={(event) => set("facilities", event.target.checked ? [...draft.facilities, facility] : draft.facilities.filter((item) => item !== facility))} />{formatUiLabel(facility)}</label>)}</div></fieldset>
              {center?.externalKey ? <p className="mt-4 break-all text-xs text-[var(--color-muted-foreground)]">Imported record: {center.externalKey}. Edits override source values.</p> : null}
              {center?.localityCode ? <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">Locality ID: {center.localityCode}</p> : null}
              {center?.sourceSnapshot ? <details className="mt-3 text-xs"><summary className="cursor-pointer">Original source values</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(center.sourceSnapshot, null, 2)}</pre></details> : null}
            </details>

            {center ? <details className="rounded-lg border border-[var(--color-border)] px-3 py-3"><summary className="cursor-pointer text-sm text-[var(--color-muted-foreground)]">Additional Actions</summary><button type="button" disabled={saving} onClick={() => void toggleArchive()} className="mt-3 rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm font-medium text-[var(--color-danger)] disabled:opacity-50">{center.isArchived ? "Restore Center" : "Archive Center"}</button></details> : null}
          </>}
        </>}
      </div>

      <footer className="flex shrink-0 justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3 sm:px-6">
        <button type="button" disabled={saving} onClick={requestClose} className="h-10 rounded-lg border border-[var(--color-border)] px-4 text-sm font-medium disabled:opacity-50">Cancel</button>
        <button type="submit" disabled={saving || loading || Boolean(centerId && (!center || !dirty))} className="h-10 rounded-lg bg-[var(--color-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : centerId ? "Save Changes" : "Add Center"}</button>
      </footer>
    </form>
  </dialog>;
}
