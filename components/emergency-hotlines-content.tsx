"use client";

import { Phone, PhoneCall } from "lucide-react";

import { EMERGENCY_HOTLINES } from "@/lib/constants";

function HotlineCard({
  name,
  number,
  coverage,
}: {
  name: string;
  number: string;
  coverage?: string;
}) {
  return (
    <article className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(37,99,235,0.1)] text-[var(--color-primary)]">
          <Phone className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-[0.96rem] font-semibold leading-6 text-[var(--color-foreground)]">
            {name}
          </h3>
          <p className="text-[0.9rem] leading-6 text-[var(--color-muted-foreground)]">
            {number}
          </p>
          {coverage ? (
            <span className="mt-1 inline-flex rounded-full bg-[var(--color-panel)] px-2 py-0.5 text-[0.68rem] font-semibold text-[var(--color-foreground)]">
              {coverage}
            </span>
          ) : null}
        </div>

        <button
          type="button"
          aria-label={`Call ${name}`}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] shadow-[var(--shadow-soft)]"
        >
          <PhoneCall className="h-4 w-4" />
        </button>
      </div>
    </article>
  );
}

export function EmergencyHotlinesContent() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1040px] flex-col px-4 py-5 md:px-7 md:py-7 xl:px-10">
        <section className="border-b border-[var(--color-border)] pb-5">
          <h1 className="text-[2.05rem] font-semibold tracking-[-0.035em] text-[var(--color-foreground)]">
            Emergency Hotlines
          </h1>
          <p className="mt-1.5 text-[1rem] text-[var(--color-muted-foreground)]">
            Official 24/7 hotlines for disaster response, rescue, medical, and weather
            agencies across the Philippines.
          </p>
        </section>

        <section className="mt-6 rounded-[20px] border border-[rgba(239,68,68,0.28)] bg-[rgba(255,248,248,0.95)] px-6 py-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-[1.12rem] font-semibold text-[#ff4d43]">
                National Emergency Hotline
              </h2>
              <p className="mt-1 text-[0.98rem] text-[var(--color-muted-foreground)]">
                For immediate life-threatening emergencies, call now.
              </p>
            </div>

            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-[12px] bg-[#ff4d43] px-5 text-[0.95rem] font-semibold text-white shadow-[0_14px_30px_rgba(255,77,67,0.22)]"
            >
              <PhoneCall className="h-4 w-4" />
              <span>Call 911</span>
            </button>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          {EMERGENCY_HOTLINES.map((hotline) => (
            <HotlineCard
              key={hotline.id}
              name={hotline.name}
              number={hotline.number}
              coverage={hotline.coverage}
            />
          ))}
        </section>
      </div>
    </div>
  );
}
