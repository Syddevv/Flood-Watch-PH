"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { BULACAN_LOCALITIES } from "@/data/bulacan-localities";
import type { AdminCenter } from "@/components/admin-evacuation-centers-page";
import { CENTER_FACILITIES, CENTER_SOURCE_TYPES, CENTER_STATUSES, CENTER_VERIFICATION_STATUSES } from "@/lib/admin-evacuation";
import { formatUiLabel } from "@/lib/ui-labels";

type Draft = {
  name: string; description: string; address: string; barangay: string;
  city: string; latitude: string; longitude: string; contactNumber: string;
  facilities: string[]; status: string; verificationStatus: string;
  sourceType: string; sourceName: string; sourceUrl: string;
  lastVerifiedAt: string; notes: string; estimatedCapacity: string;
  sourceCheckedAt: string; facilityType: string; permanent: string;
  adminEvidenceUrl: string;
  duplicateReviewNotes: string;
  confirmAvailability: boolean;
  operationalConfirmedAt: string; operationalEvidenceUrl: string; directConfirmationNote: string;
};

const emptyDraft: Draft = {
  name: "", description: "", address: "", barangay: "", city: "",
  latitude: "", longitude: "", contactNumber: "", facilities: [],
  status: "needs_verification", verificationStatus: "needs_verification",
  sourceType: "official_lgu", sourceName: "", sourceUrl: "",
  lastVerifiedAt: "", notes: "", estimatedCapacity: "", confirmAvailability: false,
  sourceCheckedAt: "", facilityType: "", permanent: "", adminEvidenceUrl: "", duplicateReviewNotes: "",
  operationalConfirmedAt: "", operationalEvidenceUrl: "", directConfirmationNote: "",
};

function fromCenter(center: AdminCenter): Draft {
  return {
    name: center.name, description: center.description ?? "", address: center.address,
    barangay: center.barangay ?? "", city: center.city,
    latitude: center.latitude?.toString() ?? "", longitude: center.longitude?.toString() ?? "",
    contactNumber: center.contactNumber ?? "", facilities: center.facilities,
    status: center.status, verificationStatus: center.verificationStatus,
    sourceType: center.sourceType, sourceName: center.sourceName ?? "",
    sourceUrl: center.sourceUrl ?? "",
    lastVerifiedAt: center.lastVerifiedAt?.slice(0, 10) ?? "",
    notes: center.notes ?? "", estimatedCapacity: center.estimatedCapacity == null ? "" : String(center.estimatedCapacity),
    sourceCheckedAt: center.sourceCheckedAt?.slice(0, 10) ?? "", facilityType: center.facilityType ?? "",
    permanent: center.permanent == null ? "" : String(center.permanent),
    adminEvidenceUrl: center.adminEvidenceUrl ?? "", duplicateReviewNotes: center.duplicateReviewNotes ?? "",
    confirmAvailability: false,
    operationalConfirmedAt: "", operationalEvidenceUrl: "", directConfirmationNote: "",
  };
}

export function AdminEvacuationCenterDetail({ centerId }: { centerId?: string }) {
  const router = useRouter();
  const [center, setCenter] = useState<AdminCenter | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [loading, setLoading] = useState(Boolean(centerId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!centerId) return;
    const controller = new AbortController();
    fetch(`/api/admin/evacuation-centers/${centerId}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Unable to load center.");
        setCenter(payload.data.center);
        setDraft(fromCenter(payload.data.center));
      })
      .catch((cause) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load center."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [centerId]);

  const set = (key: keyof Draft, value: string | boolean | string[]) => setDraft((current) => ({ ...current, [key]: value }));
  const field = (label: string, key: keyof Draft, type = "text") => (
    <label className="grid gap-1 text-sm"><span>{label}</span>
      <input className="h-10 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" type={type} step={key === "latitude" || key === "longitude" ? "any" : undefined} value={String(draft[key])} onChange={(event) => set(key, event.target.value)} />
    </label>
  );
  const select = (label: string, key: keyof Draft, options: readonly string[]) => (
    <label className="grid gap-1 text-sm"><span>{label}</span>
      <select className="h-10 min-w-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-3" value={String(draft[key])} onChange={(event) => set(key, event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => <option key={option} value={option}>{formatUiLabel(option)}</option>)}
      </select>
    </label>
  );

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true); setError(null); setNotice(null);
    try {
      const response = await fetch(centerId ? `/api/admin/evacuation-centers/${centerId}` : "/api/admin/evacuation-centers", {
        method: centerId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft, localityCode: BULACAN_LOCALITIES.find((locality) => locality.name === draft.city)?.code, province: "Bulacan", region: "Region III",
          latitude: draft.latitude ? Number(draft.latitude) : null, longitude: draft.longitude ? Number(draft.longitude) : null,
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
      if (!centerId) { router.push(`/admin/data/${payload.data.center.id}`); return; }
      setCenter(payload.data.center);
      setDraft(fromCenter(payload.data.center));
      setNotice("Center saved. Public views refresh from the database.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save center.");
    } finally { setSaving(false); }
  }

  async function toggleArchive() {
    if (!center || saving) return;
    setSaving(true); setError(null); setNotice(null);
    try {
      const action = center.isArchived ? "restore" : "archive";
      const response = await fetch(`/api/admin/evacuation-centers/${center.id}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedUpdatedAt: center.updatedAt }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? `Unable to ${action} center.`);
      setCenter(payload.data.center);
      setNotice(center.isArchived ? "Center restored." : "Center archived and hidden from public views.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to update center."); }
    finally { setSaving(false); }
  }

  if (loading) return <p role="status">Loading evacuation center…</p>;
  if (centerId && !center) return <p role="alert">{error ?? "Evacuation center not found."}</p>;

  return <div className="space-y-5">
    <Link href="/admin/data" className="text-sm text-[var(--color-primary)]">← Back to centers</Link>
    <div><h1 className="text-2xl font-semibold">{center ? "Edit evacuation center" : "Add evacuation center"}</h1>
      {center ? <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{center.name}</p> : null}</div>
    <p className="text-sm text-[var(--color-muted-foreground)]">Only sourced and dated official records become public. Estimated capacity is planning data, not current occupancy.</p>
    {center?.duplicateReviewNotes ? <p className="text-sm text-[var(--color-warning)]">Potential duplicate: {center.duplicateReviewNotes}</p> : null}
    {error ? <p role="alert" className="rounded-lg border border-red-500/30 p-3 text-red-400">{error}</p> : null}
    {notice ? <p role="status" className="rounded-lg border border-green-500/30 p-3">{notice}</p> : null}
    <form onSubmit={save} className="space-y-5">
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-4 text-lg font-semibold">Center details</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {field("Name", "name")}{field("Address", "address")}
          {select("Municipality or city", "city", BULACAN_LOCALITIES.map((locality) => locality.name))}
          {field("Barangay", "barangay")}
          {field("Contact number", "contactNumber", "tel")}{field("Facility type", "facilityType")}
          {select("Permanent facility?", "permanent", ["true", "false"])}
          {field("Estimated planning capacity", "estimatedCapacity", "number")}
          <div className="md:col-span-2">{field("Description", "description")}</div>
        </div>
        <fieldset className="mt-5"><legend className="text-sm font-medium">Facilities</legend><div className="mt-2 flex flex-wrap gap-3">
        {CENTER_FACILITIES.map((facility) => <label key={facility} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={draft.facilities.includes(facility)} onChange={(event) => set("facilities", event.target.checked ? [...draft.facilities, facility] : draft.facilities.filter((item) => item !== facility))} />{formatUiLabel(facility)}</label>)}
        </div></fieldset>
      </section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-1 text-lg font-semibold">Exact location</h2>
        <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">Leave both coordinates blank when the source does not publish an exact location. Never enter a barangay centroid.</p>
        <div className="grid gap-4 md:grid-cols-2">{field("Latitude", "latitude", "number")}{field("Longitude", "longitude", "number")}</div>
      </section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-1 text-lg font-semibold">Source and verification</h2>
        <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">Identity verification describes the source record. It does not confirm that the center is open now.</p>
        <div className="grid gap-4 md:grid-cols-2">
          {select("Identity verification", "verificationStatus", CENTER_VERIFICATION_STATUSES)}
          {select("Source type", "sourceType", CENTER_SOURCE_TYPES)}
          {field("Source name", "sourceName")}{field("Official source URL", "sourceUrl", "url")}
          {field("Last checked date", "lastVerifiedAt", "date")}{field("Source researched date", "sourceCheckedAt", "date")}
          {field("Correction evidence URL", "adminEvidenceUrl", "url")}
        </div>
      </section>
      <section className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <h2 className="mb-1 text-lg font-semibold">Current operational status</h2>
        <p className="mb-4 text-xs text-[var(--color-muted-foreground)]">Open means currently accepting evacuees. A new update requires an official announcement or documented direct confirmation.</p>
        <div className="grid gap-4 md:grid-cols-2">{select("Status", "status", CENTER_STATUSES)}</div>
        <label className="mt-4 flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={draft.confirmAvailability} onChange={(event) => set("confirmAvailability", event.target.checked)} />Record a current operational update</label>
        {draft.confirmAvailability ? <div className="mt-4 grid gap-3 md:grid-cols-2">
        {field("Operational confirmation date and time", "operationalConfirmedAt", "datetime-local")}
        {field("Current official announcement URL (HTTPS)", "operationalEvidenceUrl", "url")}
        <div className="md:col-span-2">{field("Or document direct confirmation: authority, method, and details (internal only)", "directConfirmationNote")}</div>
        <p className="text-sm text-[var(--color-muted-foreground)] md:col-span-2">Provide an official announcement URL or a documented direct confirmation. Source research dates and correction evidence do not confirm opening.</p>
        </div> : null}
      </section>
      <details className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
        <summary className="cursor-pointer font-semibold">Internal notes and source record</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">{field("Internal note", "notes")}{field("Duplicate review notes", "duplicateReviewNotes")}</div>
        {center?.externalKey ? <p className="mt-4 break-all text-xs text-[var(--color-muted-foreground)]">Imported record: {center.externalKey}. Edits override source values and survive reimport.</p> : null}
        {center?.localityCode ? <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Bulacan locality ID: {center.localityCode}</p> : null}
        {center?.sourceSnapshot ? <details className="mt-4 rounded-lg border border-[var(--color-border)] p-3 text-sm"><summary className="cursor-pointer">Original source values and references</summary><pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(center.sourceSnapshot, null, 2)}</pre></details> : null}
      </details>
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={saving} className="h-10 rounded-lg bg-[var(--color-primary)] px-4 font-semibold text-white disabled:opacity-50">{saving ? "Saving…" : "Save center"}</button><Link href="/admin/data" className="flex h-10 items-center rounded-lg border border-[var(--color-border)] px-4 text-sm">Cancel</Link></div>
    </form>
    {center ? <button type="button" disabled={saving} onClick={toggleArchive} className="rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm">{center.isArchived ? "Restore center" : "Archive center"}</button> : null}
  </div>;
}
