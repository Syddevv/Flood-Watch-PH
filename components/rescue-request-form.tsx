"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Accessibility,
  Baby,
  Camera,
  CircleSlash,
  CloudUpload,
  HeartPulse,
  LifeBuoy,
  LoaderCircle,
  Map as MapIcon,
  Minus,
  PersonStanding,
  Phone,
  Plus,
  Smartphone,
  Stethoscope,
  TriangleAlert,
  X,
  type LucideIcon,
} from "lucide-react";

import { IncidentLocationPicker } from "@/components/incident-location-picker";
import { ReportCameraCapture } from "@/components/report-camera-capture";
import { isWithinCalumpit } from "@/lib/calumpit-boundary";
import { buildCoordinateFallbackLabel } from "@/lib/geo-format";
import {
  getReportImageAcceptValue,
  validateReportImageFile,
} from "@/lib/report-image-validation";
import { resolveReportLocationName } from "@/lib/report-location-client";
import type { ReportLocationSource } from "@/lib/report-location-metadata";
import {
  RESCUE_ASSISTANCE_TAGS,
  type RescueAssistanceTagId,
} from "@/lib/rescue-request-data";
import {
  RESCUE_MAX_CONTACT_LENGTH,
  RESCUE_MAX_LOCATION_NAME_LENGTH,
  RESCUE_MAX_SITUATION_LENGTH,
  clampRescuePeopleCount,
  formatRescuePeopleLabel,
  toggleRescueAssistanceTag,
  validateRescueRequestForm,
  type RescueRequestSubmission,
} from "@/lib/rescue-request-form";
import { cn } from "@/lib/utils";

const ASSISTANCE_TAG_ICONS: Record<RescueAssistanceTagId, LucideIcon> = {
  children: Baby,
  elderly: PersonStanding,
  pwd: Accessibility,
  pregnant: HeartPulse,
  medical: Stethoscope,
  none: CircleSlash,
};

type RescueRequestFormProps = {
  signedIn: boolean;
  authLoading: boolean;
  onSubmit: (submission: RescueRequestSubmission) => Promise<boolean>;
};

const EMPTY_FIELDS = {
  locationName: "",
  latitude: "",
  longitude: "",
  situation: "",
  contactNumber: "",
};

export function RescueRequestForm({
  signedIn,
  authLoading,
  onSubmit,
}: RescueRequestFormProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [fields, setFields] = useState(EMPTY_FIELDS);
  const [locationSource, setLocationSource] =
    useState<ReportLocationSource>("manual");
  const [gpsAccuracyMeters, setGpsAccuracyMeters] = useState<number | null>(null);
  const [peopleCount, setPeopleCount] = useState(1);
  const [assistanceTagIds, setAssistanceTagIds] = useState<RescueAssistanceTagId[]>(
    [],
  );
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoCapturedAt, setPhotoCapturedAt] = useState<Date | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);

  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreviewUrl) {
        URL.revokeObjectURL(photoPreviewUrl);
      }
    };
  }, [photoPreviewUrl]);

  const submitDisabled = submitting || locatingUser || !signedIn;

  function updateField(key: keyof typeof EMPTY_FIELDS, value: string) {
    setErrorMessage(null);
    setFields((current) => ({ ...current, [key]: value }));
  }

  function attachPhoto(file: File, capturedAt: Date | null) {
    const validationError = validateReportImageFile({
      name: file.name,
      type: file.type,
      size: file.size,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    // Revoke the previous object URL before replacing it, or the browser holds
    // the discarded blob for the lifetime of the page.
    setPhotoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return URL.createObjectURL(file);
    });
    setPhoto(file);
    setPhotoCapturedAt(capturedAt);
    setErrorMessage(null);
  }

  function clearPhoto() {
    setPhotoPreviewUrl((current) => {
      if (current) {
        URL.revokeObjectURL(current);
      }

      return null;
    });
    setPhoto(null);
    setPhotoCapturedAt(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    setFields(EMPTY_FIELDS);
    setLocationSource("manual");
    setGpsAccuracyMeters(null);
    setPeopleCount(1);
    setAssistanceTagIds([]);
    clearPhoto();
  }

  function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setErrorMessage("This browser does not support location sharing.");
      return;
    }

    setErrorMessage(null);
    setLocatingUser(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { accuracy, latitude, longitude } = position.coords;

        // Same rule as the server: no tolerance buffer, because a borderline
        // point accepted here would only be rejected on submit.
        if (!isWithinCalumpit(latitude, longitude)) {
          setLocatingUser(false);
          setErrorMessage(
            "Your current location appears to be outside Calumpit, Bulacan. If you are near the boundary, pick the exact spot on the map instead.",
          );
          setLocationPickerOpen(true);
          return;
        }

        setLocationSource("gps");
        setGpsAccuracyMeters(Number.isFinite(accuracy) ? accuracy : null);
        setFields((current) => ({
          ...current,
          latitude: String(latitude),
          longitude: String(longitude),
        }));

        try {
          const { locationName } = await resolveReportLocationName(
            latitude,
            longitude,
          );
          setFields((current) => ({ ...current, locationName }));
        } catch {
          setFields((current) => ({
            ...current,
            locationName: buildCoordinateFallbackLabel(
              latitude,
              longitude,
              "Pinned location near",
            ),
          }));
        } finally {
          setLocatingUser(false);
        }
      },
      () => {
        setLocatingUser(false);
        setErrorMessage(
          "Location sharing was blocked. Choose your spot on the map instead.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (submitting) {
      return;
    }

    const validationError = validateRescueRequestForm({
      locationName: fields.locationName,
      latitude: fields.latitude,
      longitude: fields.longitude,
      situation: fields.situation,
    });

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setErrorMessage(null);
    setSubmitting(true);

    try {
      const accepted = await onSubmit({
        locationName: fields.locationName.trim(),
        latitude: fields.latitude,
        longitude: fields.longitude,
        locationSource,
        gpsAccuracyMeters,
        peopleCount,
        assistanceTagIds,
        situation: fields.situation,
        contactNumber: fields.contactNumber,
        photo,
        photoCapturedAt,
      });

      if (accepted) {
        resetForm();
      }
    } catch (cause) {
      setErrorMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : "Unable to send your rescue request. Try again in a moment.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        data-testid="rescue-request-form"
        className="rounded-[var(--radius-card)] border border-[color:color-mix(in_srgb,var(--color-border)_80%,transparent)] bg-[color:color-mix(in_srgb,var(--color-surface)_94%,transparent)] p-4 shadow-[var(--shadow-soft)] sm:p-6"
      >
        <p className="flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-danger-border)] bg-[color:color-mix(in_srgb,var(--color-danger)_6%,var(--color-surface))] p-3.5 text-[0.86rem] leading-6 text-[var(--color-foreground)]">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger)]" />
          <span>
            <strong className="font-semibold text-[var(--color-danger)]">
              If life is in immediate danger, call 911 now.
            </strong>{" "}
            Use this form when it is safe to wait for a coordinated rescue team.
          </span>
        </p>

        <section className="mt-5">
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Where do you need help?
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Pin your exact location so responders can reach you quickly.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locatingUser}
              data-testid="rescue-use-current-location"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_70%,transparent)] px-3 py-2.5 text-[0.84rem] font-medium text-[var(--color-foreground)] transition hover:border-[var(--color-primary)] disabled:opacity-60"
            >
              {locatingUser ? (
                <LoaderCircle className="h-4 w-4 shrink-0 animate-spin text-[var(--color-primary)]" />
              ) : (
                <Smartphone className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              )}
              <span>
                {locatingUser ? "Getting your location..." : "Use My Current Location"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setLocationPickerOpen(true)}
              data-testid="rescue-choose-on-map"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_70%,transparent)] px-3 py-2.5 text-[0.84rem] font-medium text-[var(--color-foreground)] transition hover:border-[var(--color-primary)]"
            >
              <MapIcon className="h-4 w-4 shrink-0 text-[var(--color-primary)]" />
              <span>Choose on Map</span>
            </button>
          </div>

          <label className="mt-2.5 block">
            <span className="sr-only">Location</span>
            <input
              value={fields.locationName}
              onChange={(event) => {
                setLocationSource("manual");
                updateField("locationName", event.target.value);
              }}
              maxLength={RESCUE_MAX_LOCATION_NAME_LENGTH}
              placeholder="Street, barangay, city or coordinates"
              data-testid="rescue-location-name"
              className="w-full rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] px-3 py-2.5 text-[0.86rem] text-[var(--color-foreground)] outline-none transition placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)]"
            />
          </label>
        </section>

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <section>
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            People needing assistance
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Include yourself in the total count.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)]">
              <button
                type="button"
                aria-label="Decrease people needing assistance"
                data-testid="rescue-people-decrement"
                onClick={() =>
                  setPeopleCount((current) => clampRescuePeopleCount(current - 1))
                }
                className="flex h-11 w-11 items-center justify-center rounded-l-[var(--radius-control)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
              >
                <Minus className="h-4 w-4" />
              </button>

              <span
                data-testid="rescue-people-count"
                aria-live="polite"
                className="min-w-11 text-center text-[0.95rem] font-semibold tabular-nums text-[var(--color-foreground)]"
              >
                {peopleCount}
              </span>

              <button
                type="button"
                aria-label="Increase people needing assistance"
                data-testid="rescue-people-increment"
                onClick={() =>
                  setPeopleCount((current) => clampRescuePeopleCount(current + 1))
                }
                className="flex h-11 w-11 items-center justify-center rounded-r-[var(--radius-control)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-foreground)]"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>

            <span className="text-[0.84rem] text-[var(--color-muted-foreground)]">
              {formatRescuePeopleLabel(peopleCount)}
            </span>
          </div>
        </section>

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <section>
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Special assistance needed
          </h2>
          <p className="mt-0.5 text-[0.8rem] text-[var(--color-muted-foreground)]">
            Select all that apply so responders can prepare.
          </p>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {RESCUE_ASSISTANCE_TAGS.map((tag) => {
              const Icon = ASSISTANCE_TAG_ICONS[tag.id];
              const selected = assistanceTagIds.includes(tag.id);

              return (
                <button
                  key={tag.id}
                  type="button"
                  aria-pressed={selected}
                  data-testid={`rescue-assistance-${tag.id}`}
                  onClick={() =>
                    setAssistanceTagIds((current) =>
                      toggleRescueAssistanceTag(current, tag.id),
                    )
                  }
                  className={cn(
                    "flex flex-col gap-1.5 rounded-[var(--radius-control)] border p-3 text-left transition",
                    selected
                      ? "border-[var(--color-primary)] bg-[var(--color-info-surface)]"
                      : "border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] hover:border-[color:color-mix(in_srgb,var(--color-primary)_50%,transparent)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0",
                      selected
                        ? "text-[var(--color-primary)]"
                        : "text-[var(--color-muted-foreground)]",
                    )}
                  />
                  <span className="text-[0.86rem] font-semibold text-[var(--color-foreground)]">
                    {tag.label}
                  </span>
                  <span className="text-[0.74rem] leading-5 text-[var(--color-muted-foreground)]">
                    {tag.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <label className="mt-5 block">
          <span className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Describe your situation
          </span>
          <textarea
            value={fields.situation}
            onChange={(event) => updateField("situation", event.target.value)}
            rows={4}
            maxLength={RESCUE_MAX_SITUATION_LENGTH}
            placeholder="Water level, whether you can move to higher ground, urgent medical needs, landmarks near you..."
            data-testid="rescue-situation"
            className="mt-2 w-full resize-y rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] p-3 text-[0.86rem] leading-6 text-[var(--color-foreground)] outline-none transition placeholder:text-[var(--color-muted-foreground)] focus:border-[var(--color-primary)]"
          />
        </label>

        <label className="mt-4 block">
          <span className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Contact number
          </span>
          <span className="mt-2 flex items-center gap-2 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] px-3 transition focus-within:border-[var(--color-primary)]">
            <Phone className="h-4 w-4 shrink-0 text-[var(--color-muted-foreground)]" />
            <input
              value={fields.contactNumber}
              onChange={(event) => updateField("contactNumber", event.target.value)}
              type="tel"
              inputMode="tel"
              maxLength={RESCUE_MAX_CONTACT_LENGTH}
              placeholder="09xx xxx xxxx"
              data-testid="rescue-contact"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-[0.86rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
            />
          </span>
        </label>

        <section className="mt-4">
          <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
            Add a photo (optional)
          </h2>

          <input
            ref={fileInputRef}
            type="file"
            accept={getReportImageAcceptValue()}
            className="hidden"
            data-testid="rescue-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                attachPhoto(file, null);
              }
            }}
          />

          {photo && photoPreviewUrl ? (
            <div className="mt-2 flex items-center gap-3 rounded-[var(--radius-control)] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_58%,transparent)] p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoPreviewUrl}
                alt="Attached photo preview"
                className="h-16 w-16 shrink-0 rounded-[10px] object-cover"
              />
              <span className="min-w-0 flex-1 truncate text-[0.82rem] text-[var(--color-foreground)]">
                {photo.name}
              </span>
              <button
                type="button"
                onClick={clearPhoto}
                aria-label="Remove photo"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-[color:color-mix(in_srgb,var(--color-border)_74%,transparent)] text-[var(--color-muted-foreground)] transition hover:text-[var(--color-danger)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="mt-2 flex flex-col items-center gap-2 rounded-[var(--radius-control)] border border-dashed border-[color:color-mix(in_srgb,var(--color-border)_82%,transparent)] bg-[color:color-mix(in_srgb,var(--color-panel)_44%,transparent)] px-4 py-6 text-center">
              <CloudUpload className="h-5 w-5 text-[var(--color-muted-foreground)]" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                data-testid="rescue-photo-upload"
                className="text-[0.86rem] font-semibold text-[var(--color-foreground)] underline-offset-4 hover:underline"
              >
                Tap to add a photo
              </button>
              <p className="text-[0.74rem] text-[var(--color-muted-foreground)]">
                Helps responders assess the scene
              </p>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="mt-1 inline-flex items-center gap-1.5 text-[0.78rem] font-medium text-[var(--color-primary)]"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Take a photo instead</span>
              </button>
            </div>
          )}
        </section>

        {errorMessage ? (
          <p
            role="alert"
            data-testid="rescue-form-error"
            className="mt-4 flex items-start gap-2 rounded-[var(--radius-panel)] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] p-3 text-[0.82rem] leading-6 text-[var(--color-danger-text)]"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </p>
        ) : null}

        {!authLoading && !signedIn ? (
          <p
            data-testid="rescue-signin-notice"
            className="mt-4 rounded-[var(--radius-panel)] border border-[var(--color-info-border)] bg-[var(--color-info-surface)] p-3 text-[0.82rem] leading-6 text-[var(--color-foreground)]"
          >
            <Link
              href="/login?next=/rescue-request"
              className="font-semibold text-[var(--color-primary)] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>{" "}
            to send a rescue request so responders can follow up with you safely.
          </p>
        ) : null}

        <hr className="my-5 border-[color:color-mix(in_srgb,var(--color-border)_70%,transparent)]" />

        <button
          type="submit"
          disabled={submitDisabled}
          data-testid="rescue-submit"
          className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--color-primary)] px-4 py-3 text-[0.92rem] font-semibold text-white shadow-[var(--shadow-primary)] transition disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" />
          ) : (
            <LifeBuoy className="h-4 w-4 shrink-0" />
          )}
          <span>{submitting ? "Sending request..." : "Send Rescue Request"}</span>
        </button>

        <p className="mt-2.5 text-center text-[0.74rem] text-[var(--color-muted-foreground)]">
          By submitting, you confirm this is a genuine request. False reports delay
          real rescues.
        </p>
      </form>

      <ReportCameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onCapture={(file, capturedAt) => {
          attachPhoto(file, capturedAt);
          setCameraOpen(false);
        }}
        onUploadInstead={() => {
          setCameraOpen(false);
          fileInputRef.current?.click();
        }}
      />

      {locationPickerOpen ? (
        <IncidentLocationPicker
          open={locationPickerOpen}
          initialLocationName={fields.locationName}
          initialLatitude={fields.latitude}
          initialLongitude={fields.longitude}
          onClose={() => setLocationPickerOpen(false)}
          onConfirm={(location) => {
            setLocationSource(location.source);
            setGpsAccuracyMeters(null);
            setFields((current) => ({
              ...current,
              locationName: location.locationName,
              latitude: location.latitude,
              longitude: location.longitude,
            }));
            setErrorMessage(null);
            setLocationPickerOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
