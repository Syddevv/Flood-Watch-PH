"use client";

import { useMemo, useState } from "react";
import {
  Activity,
  Building2,
  CloudRain,
  Copy,
  LifeBuoy,
  LocateFixed,
  MapPinned,
  Phone,
  Share2,
  ShieldAlert,
  Stethoscope,
  Waves,
} from "lucide-react";

import { EMERGENCY_HOTLINES } from "@/lib/constants";
import type { EmergencyHotline } from "@/lib/types";
import { cn } from "@/lib/utils";

const HOTLINE_FILTERS = [
  "All",
  "National",
  "Local Government",
  "Flood & Weather",
  "Medical",
  "Rescue",
  "Traffic",
  "Utilities",
] as const;

type HotlineFilter = (typeof HOTLINE_FILTERS)[number];

const CATEGORY_META: Record<
  EmergencyHotline["category"],
  { title: string; icon: React.ReactNode; accentClassName: string }
> = {
  "Emergency Response": {
    title: "Emergency Response",
    icon: <ShieldAlert className="h-4 w-4" />,
    accentClassName: "text-[#ef4444]",
  },
  "Flood & Weather Monitoring": {
    title: "Flood & Weather Monitoring",
    icon: <Waves className="h-4 w-4" />,
    accentClassName: "text-[var(--color-primary)]",
  },
  "Medical & Health": {
    title: "Medical & Health",
    icon: <Stethoscope className="h-4 w-4" />,
    accentClassName: "text-[#16a34a]",
  },
  "Maritime & Water Rescue": {
    title: "Maritime & Water Rescue",
    icon: <LifeBuoy className="h-4 w-4" />,
    accentClassName: "text-[var(--color-primary)]",
  },
  "Local DRRM Offices": {
    title: "Local DRRM Offices",
    icon: <Building2 className="h-4 w-4" />,
    accentClassName: "text-[var(--color-foreground)]",
  },
  Traffic: {
    title: "Traffic",
    icon: <Activity className="h-4 w-4" />,
    accentClassName: "text-[var(--color-warning)]",
  },
  Utilities: {
    title: "Utilities",
    icon: <Building2 className="h-4 w-4" />,
    accentClassName: "text-[var(--color-muted-foreground)]",
  },
};

const QUICK_CONTACT_IDS = [
  "hotline-red-cross",
  "hotline-mmda",
  "hotline-pagasa",
] as const;

const NEARBY_CONTACTS = [
  {
    id: "nearby-bulacan",
    name: "Bulacan DRRMO",
    detail: "Provincial disaster coordination and rescue support.",
    coverage: "Region III",
  },
  {
    id: "nearby-rescue",
    name: "Municipal Rescue Office",
    detail: "Nearest responder for flood incidents and evacuation support.",
    coverage: "Local Government",
  },
  {
    id: "nearby-hospital",
    name: "Nearest Public Hospital",
    detail: "Emergency medical care and ambulance referral access.",
    coverage: "Medical",
  },
  {
    id: "nearby-center",
    name: "Nearest Evacuation Center",
    detail: "Shelter and relief access during flooding or severe weather.",
    coverage: "Community Support",
  },
];

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

function HotlineActionButton({
  icon,
  label,
  onClick,
  variant = "default",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "critical";
}) {
  const className = cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-[11px] px-4 text-[0.92rem] font-medium leading-5 whitespace-nowrap transition",
    variant === "critical"
      ? "bg-[#ff4d43] text-white shadow-[0_14px_30px_rgba(255,77,67,0.18)] hover:brightness-105"
      : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-foreground)] hover:bg-[var(--color-panel)]",
  );

  return (
    <button type="button" onClick={onClick} className={className}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HotlineCard({
  hotline,
  onCopy,
  onShare,
}: {
  hotline: EmergencyHotline;
  onCopy: (hotline: EmergencyHotline) => void;
  onShare: (hotline: EmergencyHotline) => void;
}) {
  const Icon = hotline.icon;

  return (
    <article className="flex h-full flex-col rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-1 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px] bg-[rgba(37,99,235,0.1)] text-[var(--color-primary)]">
          <Icon className="h-5 w-5" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[1rem] font-semibold leading-6 text-[var(--color-foreground)]">
              {hotline.name}
            </h3>
            <span className="rounded-full bg-[var(--color-panel)] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--color-foreground)]">
              {hotline.coverage}
            </span>
          </div>

          <p className="mt-0.5 text-[0.98rem] font-medium text-[var(--color-primary)]">
            {hotline.number}
          </p>
          <p className="mt-2 text-[0.88rem] leading-6 text-[var(--color-muted-foreground)]">
            {hotline.serviceDescription}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {hotline.statusBadges.map((badge) => (
              <span
                key={badge}
                className="inline-flex items-center gap-1.5 rounded-full bg-[rgba(34,197,94,0.1)] px-2.5 py-1 text-[0.7rem] font-semibold text-[#15803d]"
              >
                <span className="h-2 w-2 rounded-full bg-[#22c55e]" />
                {badge}
              </span>
            ))}
          </div>

          <div className="flex-1" />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <HotlineActionButton
          icon={<Phone className="h-4 w-4" />}
          label="Call"
          onClick={() => {
            window.location.href = `tel:${hotline.number.replace(/[^\d+]/g, "")}`;
          }}
          variant={hotline.number === "911" ? "critical" : "default"}
        />
        <HotlineActionButton
          icon={<Copy className="h-4 w-4" />}
          label="Copy Number"
          onClick={() => onCopy(hotline)}
        />
        <HotlineActionButton
          icon={<Share2 className="h-4 w-4" />}
          label="Share Contact"
          onClick={() => onShare(hotline)}
        />
      </div>
    </article>
  );
}

function QuickContactCard({
  title,
  number,
  description,
  icon,
}: {
  title: string;
  number: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <article className="flex h-full flex-col rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[rgba(37,99,235,0.12)] text-[var(--color-primary)]">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-[1rem] font-semibold leading-6 text-[var(--color-foreground)]">
            {title}
          </h3>
          <div className="mt-0.5 text-[1.18rem] font-semibold tracking-[-0.02em] text-[var(--color-primary)]">
            {number}
          </div>
          <p className="mt-1.5 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
            {description}
          </p>
        </div>
      </div>

      <div className="flex-1" />

      <a
        href={`tel:${number.replace(/[^\d+]/g, "")}`}
        className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-4 text-[0.98rem] font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.2)]"
      >
        <Phone className="h-4 w-4" />
        <span>Call Now</span>
      </a>
    </article>
  );
}

export function EmergencyHotlinesContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<HotlineFilter>("All");
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const quickContacts = useMemo(() => {
    const quickMapped = EMERGENCY_HOTLINES.filter((hotline) =>
      QUICK_CONTACT_IDS.includes(hotline.id as (typeof QUICK_CONTACT_IDS)[number]),
    );

    return [
      {
        id: "emergency-911",
        title: "Emergency Hotline",
        number: "911",
        description: "Immediate emergency response for life-threatening situations.",
        icon: <ShieldAlert className="h-5 w-5" />,
      },
      ...quickMapped.map((hotline) => ({
        id: hotline.id,
        title: hotline.name,
        number: hotline.number,
        description: hotline.serviceDescription,
        icon: <hotline.icon className="h-5 w-5" />,
      })),
    ];
  }, []);

  const filteredHotlines = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(searchQuery);

    return EMERGENCY_HOTLINES.filter((hotline) => {
      const matchesFilter =
        activeFilter === "All" || hotline.filterTags.includes(activeFilter);

      if (!matchesFilter) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      const searchableValue = [
        hotline.name,
        hotline.number,
        hotline.coverage,
        hotline.category,
        hotline.serviceDescription,
        ...hotline.filterTags,
      ]
        .join(" ")
        .toLowerCase();

      return searchableValue.includes(normalizedQuery);
    });
  }, [activeFilter, searchQuery]);

  const groupedHotlines = useMemo(() => {
    const categoryOrder: EmergencyHotline["category"][] = [
      "Emergency Response",
      "Flood & Weather Monitoring",
      "Medical & Health",
      "Maritime & Water Rescue",
      "Local DRRM Offices",
      "Traffic",
      "Utilities",
    ];

    return categoryOrder
      .map((category) => ({
        category,
        hotlines: filteredHotlines.filter((hotline) => hotline.category === category),
      }))
      .filter((group) => group.hotlines.length > 0);
  }, [filteredHotlines]);

  function handleCopy(hotline: EmergencyHotline) {
    navigator.clipboard
      .writeText(hotline.number)
      .then(() => {
        setCopiedId(hotline.id);
        window.setTimeout(() => setCopiedId(null), 1800);
      })
      .catch(() => undefined);
  }

  function handleShare(hotline: EmergencyHotline) {
    const text = `${hotline.name} - ${hotline.number}`;

    if (navigator.share) {
      navigator.share({
        title: hotline.name,
        text,
      }).catch(() => undefined);
      return;
    }

    navigator.clipboard.writeText(text).catch(() => undefined);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1320px] flex-col gap-6 px-4 py-5 md:px-7 md:py-7 xl:px-10">
        <section className="border-b border-[var(--color-border)] pb-5">
          <h1 className="text-[2.1rem] font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">
            Emergency Contacts & Assistance
          </h1>
          <p className="mt-1.5 max-w-[760px] text-[1rem] text-[var(--color-muted-foreground)]">
            Quick access to emergency response, rescue, medical, flood, and weather
            agencies across the Philippines.
          </p>
        </section>

        <section className="rounded-[22px] border border-[rgba(239,68,68,0.26)] bg-[linear-gradient(135deg,rgba(255,248,248,0.96),rgba(255,255,255,0.98))] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-[0.82rem] font-semibold uppercase tracking-[0.1em] text-[#ef4444]">
            <ShieldAlert className="h-4 w-4" />
            <span>Quick Emergency Contacts</span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickContacts.map((contact) => (
              <QuickContactCard
                key={contact.id}
                title={contact.title}
                number={contact.number}
                description={contact.description}
                icon={contact.icon}
              />
            ))}
          </div>
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[1.12rem] font-semibold text-[var(--color-foreground)]">
                Nearby Emergency Services
              </h2>
              <p className="mt-1 text-[0.9rem] text-[var(--color-muted-foreground)]">
                Based on your location
              </p>
            </div>

            <button
              type="button"
              onClick={() => setLocationEnabled(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.9rem] font-medium text-[var(--color-foreground)]"
            >
              <LocateFixed className="h-4 w-4" />
              <span>{locationEnabled ? "Location Enabled" : "Enable Location Services"}</span>
            </button>
          </div>

          {locationEnabled ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              {NEARBY_CONTACTS.map((service) => (
                <div
                  key={service.id}
                  className="rounded-[18px] border border-[var(--color-border)] bg-[var(--color-panel)] p-4"
                >
                  <div className="flex items-center gap-2 text-[var(--color-primary)]">
                    <MapPinned className="h-4 w-4" />
                    <span className="text-[0.76rem] font-semibold uppercase tracking-[0.08em]">
                      Nearby
                    </span>
                  </div>
                  <div className="mt-3 text-[0.98rem] font-semibold text-[var(--color-foreground)]">
                    {service.name}
                  </div>
                  <p className="mt-1 text-[0.84rem] leading-6 text-[var(--color-muted-foreground)]">
                    {service.detail}
                  </p>
                  <div className="mt-3">
                    <span className="rounded-full bg-[var(--color-surface)] px-2.5 py-1 text-[0.7rem] font-semibold text-[var(--color-foreground)]">
                      {service.coverage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-[16px] border border-dashed border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4 text-[0.9rem] text-[var(--color-muted-foreground)]">
              Enable location services to view nearby emergency contacts.
            </div>
          )}
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-[1.12rem] font-semibold text-[var(--color-foreground)]">
                Search and Filter Hotlines
              </h2>
              <p className="mt-1 text-[0.9rem] text-[var(--color-muted-foreground)]">
                Search agency, hotline, city, or service category.
              </p>
            </div>

            {copiedId ? (
              <div className="rounded-full bg-[rgba(34,197,94,0.1)] px-3 py-1.5 text-[0.76rem] font-semibold text-[#15803d]">
                Number copied to clipboard
              </div>
            ) : null}
          </div>

          <div className="mt-4">
            <label className="flex h-12 items-center gap-3 rounded-[14px] border border-[var(--color-border)] bg-[var(--color-panel)] px-4">
              <Phone className="h-4 w-4 text-[var(--color-muted-foreground)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search agency, hotline, city, or service..."
                className="w-full bg-transparent text-[0.92rem] text-[var(--color-foreground)] outline-none placeholder:text-[var(--color-muted-foreground)]"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {HOTLINE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "rounded-full px-3.5 py-2 text-[0.8rem] font-semibold transition",
                  activeFilter === filter
                    ? "bg-[var(--color-primary)] text-white"
                    : "border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-5">
          {groupedHotlines.map((group) => {
            const meta = CATEGORY_META[group.category];

            return (
              <div
                key={group.category}
                className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-center gap-2">
                  <div className={cn("flex items-center gap-2", meta.accentClassName)}>
                    {meta.icon}
                    <span className="text-[1.05rem] font-semibold text-[var(--color-foreground)]">
                      {meta.title}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  {group.hotlines.map((hotline) => (
                    <HotlineCard
                      key={hotline.id}
                      hotline={hotline}
                      onCopy={handleCopy}
                      onShare={handleShare}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-[22px] border border-[rgba(37,99,235,0.18)] bg-[linear-gradient(135deg,rgba(239,246,255,0.92),rgba(255,255,255,0.98))] p-5 shadow-[var(--shadow-soft)]">
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <CloudRain className="h-5 w-5" />
            <h2 className="text-[1.12rem] font-semibold text-[var(--color-foreground)]">
              Flood Safety Tips
            </h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[
              "Move to higher ground immediately",
              "Avoid walking or driving through floodwaters",
              "Monitor official weather advisories",
              "Prepare an emergency go-bag",
              "Keep emergency numbers accessible",
            ].map((tip) => (
              <div
                key={tip}
                className="flex items-start gap-2 rounded-[16px] bg-[rgba(255,255,255,0.72)] px-4 py-3 text-[0.9rem] text-[var(--color-foreground)]"
              >
                <span className="mt-0.5 text-[#16a34a]">✓</span>
                <span>{tip}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-4 inline-flex h-11 items-center justify-center rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 text-[0.92rem] font-semibold text-[var(--color-foreground)]"
          >
            View Full Safety Guide
          </button>
        </section>
      </div>
    </div>
  );
}
