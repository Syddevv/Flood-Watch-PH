"use client";

import { useState } from "react";
import { CircleCheck, LifeBuoy } from "lucide-react";

import { useAuthSession } from "@/components/auth-session-provider";
import { RescueRequestAside } from "@/components/rescue-request-aside";
import { RescueRequestCard } from "@/components/rescue-request-card";
import { RescueRequestForm } from "@/components/rescue-request-form";
import {
  SAMPLE_RESCUE_REQUESTS,
  buildPendingTimeline,
  type RescueRequestRecord,
} from "@/lib/rescue-request-data";
import {
  RESCUE_REPORT_CATEGORY,
  RESCUE_REPORT_SEVERITY,
  RESCUE_REPORT_TITLE,
  buildRescueRequestDescription,
  formatRescuePeopleLabel,
  type RescueRequestSubmission,
} from "@/lib/rescue-request-form";

function formatClockTime(date: Date) {
  return date.toLocaleTimeString("en-PH", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Sample ids follow RR-YYMM-NNNN, so locally filed ones do too. */
function buildLocalRequestId(date: Date) {
  const year = String(date.getFullYear()).slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const sequence = String(Math.floor(Math.random() * 10_000)).padStart(4, "0");

  return `RR-${year}${month}-${sequence}`;
}

/**
 * Public Request Rescue view.
 *
 * Submissions go through the shared flood-report endpoint as a critical
 * "Rescue Needed" report. The listed requests are sample records - there is no
 * RescueRequest model yet - with anything filed in this session prepended so
 * the user sees their submission land.
 */
export function RescueRequestContent() {
  const { user, isLoading: authLoading } = useAuthSession();
  const [requests, setRequests] = useState<RescueRequestRecord[]>(
    SAMPLE_RESCUE_REQUESTS,
  );
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(submission: RescueRequestSubmission) {
    const description = buildRescueRequestDescription({
      situation: submission.situation,
      peopleCount: submission.peopleCount,
      assistanceTagIds: submission.assistanceTagIds,
      contactNumber: submission.contactNumber,
    });

    const body = new FormData();
    body.set("title", RESCUE_REPORT_TITLE);
    body.set("description", description);
    body.set("category", RESCUE_REPORT_CATEGORY);
    body.set("severity", RESCUE_REPORT_SEVERITY);
    body.set("locationName", submission.locationName);
    body.set("latitude", submission.latitude);
    body.set("longitude", submission.longitude);
    body.set("locationSource", submission.locationSource);

    if (submission.gpsAccuracyMeters !== null) {
      body.set("gpsAccuracyMeters", String(submission.gpsAccuracyMeters));
    }

    if (user?.displayName) {
      body.set("reportedByName", user.displayName);
    }

    if (submission.photo) {
      body.set("image", submission.photo);
    }

    if (submission.photoCapturedAt) {
      body.set("photoCapturedAt", submission.photoCapturedAt.toISOString());
    }

    const response = await fetch("/api/reports", { method: "POST", body });
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        payload && typeof payload.error === "string"
          ? payload.error
          : "Unable to send your rescue request. Try again in a moment.";

      throw new Error(message);
    }

    const now = new Date();
    const clockTime = formatClockTime(now);

    setRequests((current) => [
      {
        id: buildLocalRequestId(now),
        statusLabel: "Request Received",
        complete: false,
        locationName: submission.locationName,
        peopleCount: submission.peopleCount,
        submittedLabel: `Today, ${clockTime}`,
        assignedTeam: null,
        assistanceTagIds: submission.assistanceTagIds,
        description: submission.situation.trim(),
        timeline: buildPendingTimeline(clockTime),
      },
      ...current,
    ]);

    setSuccessMessage(
      `Rescue request sent for ${formatRescuePeopleLabel(submission.peopleCount)}. Keep your phone reachable.`,
    );

    return true;
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-6 px-4 py-5 pb-[calc(env(safe-area-inset-bottom)+2rem)] md:px-7 md:py-7 xl:px-10">
        <section className="border-b border-[var(--color-border)] pb-5">
          <h1 className="text-[2.1rem] font-semibold leading-tight tracking-[-0.04em] text-[var(--color-foreground)]">
            Request Rescue Assistance
          </h1>
          <p className="mt-1.5 max-w-[760px] text-[1rem] leading-7 text-[var(--color-muted-foreground)]">
            Send your location and situation to local response teams. Help is
            coordinated by area — stay calm, stay safe, and keep your phone
            reachable.
          </p>
        </section>

        <section className="flex items-start gap-3 rounded-[var(--radius-card)] border border-[var(--color-info-border)] bg-[var(--color-info-surface)] p-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[color:color-mix(in_srgb,var(--color-primary)_16%,transparent)] text-[var(--color-primary)]">
            <LifeBuoy className="h-5 w-5" />
          </span>

          <div className="min-w-0">
            <h2 className="text-[0.95rem] font-semibold text-[var(--color-foreground)]">
              You are not alone — help is being organized.
            </h2>
            <p className="mt-1 text-[0.86rem] leading-6 text-[var(--color-muted-foreground)]">
              Every request is routed to the nearest available rescue team. Provide
              clear details below so responders can reach you faster.
            </p>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-6">
            {successMessage ? (
              <p
                role="status"
                data-testid="rescue-success"
                className="flex items-start gap-2 rounded-[var(--radius-panel)] border border-[var(--color-success-border)] bg-[var(--color-success-surface)] p-3 text-[0.86rem] leading-6 text-[var(--color-success-text)]"
              >
                <CircleCheck className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{successMessage}</span>
              </p>
            ) : null}

            <RescueRequestForm
              signedIn={Boolean(user)}
              authLoading={authLoading}
              onSubmit={handleSubmit}
            />

            <section>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[1.25rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
                  My Rescue Requests
                </h2>
                <span
                  data-testid="rescue-request-count"
                  className="text-[0.82rem] text-[var(--color-muted-foreground)]"
                >
                  {requests.length === 1 ? "1 request" : `${requests.length} requests`}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-4">
                {requests.map((request) => (
                  <RescueRequestCard key={request.id} request={request} />
                ))}
              </div>
            </section>
          </div>

          <aside className="min-w-0 lg:sticky lg:top-5">
            <RescueRequestAside />
          </aside>
        </div>
      </div>
    </div>
  );
}
