"use client";

import {
  Bell,
  Eye,
  Info,
  Map,
  Megaphone,
  Plane,
  ShieldCheck,
  Waves,
  Building2,
  CloudRain,
} from "lucide-react";

type StepCard = {
  id: string;
  step: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

type RiskCard = {
  id: string;
  label: string;
  description: string;
  accentClassName: string;
  borderClassName: string;
  dotClassName: string;
};

type FeatureCard = {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
};

const STEP_CARDS: StepCard[] = [
  {
    id: "monitor",
    step: "STEP 1",
    title: "Monitor",
    description:
      "We combine community reports, mapped hazard signals, and public weather monitoring into one public flood view.",
    icon: <Eye className="h-4 w-4" />,
  },
  {
    id: "alert",
    step: "STEP 2",
    title: "Alert",
    description:
      "Color-coded flood zones and public alert cards highlight which areas are safe, at risk, or experiencing severe flooding right now.",
    icon: <Bell className="h-4 w-4" />,
  },
  {
    id: "act",
    step: "STEP 3",
    title: "Act",
    description:
      "Find nearby evacuation references, view emergency hotlines, and report flooding you witness in your community.",
    icon: <Plane className="h-4 w-4" />,
  },
];

const RISK_CARDS: RiskCard[] = [
  {
    id: "safe",
    label: "Safe",
    description: "No significant flooding expected. Stay aware of updates.",
    accentClassName: "text-[#22c55e]",
    borderClassName: "border-[rgba(34,197,94,0.34)]",
    dotClassName: "bg-[#22c55e]",
  },
  {
    id: "moderate",
    label: "Moderate Risk",
    description: "Street-level flooding possible. Monitor conditions closely.",
    accentClassName: "text-[#f59e0b]",
    borderClassName: "border-[rgba(245,158,11,0.34)]",
    dotClassName: "bg-[#f59e0b]",
  },
  {
    id: "high",
    label: "High Risk",
    description: "Significant flooding likely. Prepare to relocate.",
    accentClassName: "text-[#f97316]",
    borderClassName: "border-[rgba(249,115,22,0.34)]",
    dotClassName: "bg-[#f97316]",
  },
  {
    id: "severe",
    label: "Severe Flooding",
    description: "Dangerous flooding underway. Evacuate immediately.",
    accentClassName: "text-[#ef4444]",
    borderClassName: "border-[rgba(239,68,68,0.28)]",
    dotClassName: "bg-[#ef4444]",
  },
];

const FEATURE_CARDS: FeatureCard[] = [
  {
    id: "map",
    title: "Interactive Flood Map",
    description:
      "Real-time color-coded flood zones, incidents, evacuation centers, and emergency services.",
    icon: <Map className="h-5 w-5" />,
  },
  {
    id: "weather",
    title: "Weather Monitoring",
    description:
      "Rainfall, wind, humidity, and storm-signal tracking for the whole region.",
    icon: <CloudRain className="h-5 w-5" />,
  },
  {
    id: "centers",
    title: "Evacuation Centers",
    description:
      "Public shelter references and directions to help you plan where to go.",
    icon: <Building2 className="h-5 w-5" />,
  },
  {
    id: "reports",
    title: "Public Incident Reports",
    description:
      "Anyone can report flooding to help neighbors and responders stay informed.",
    icon: <Megaphone className="h-5 w-5" />,
  },
];

export function AboutContent() {
  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[var(--color-background)]">
      <div className="mx-auto flex min-h-full w-full max-w-[1140px] flex-col gap-10 px-4 py-6 md:px-8 md:py-8 xl:px-10">
        <section className="border-b border-[var(--color-border)] pb-6">
          <h1 className="text-[2.15rem] font-semibold tracking-[-0.04em] text-[var(--color-foreground)]">
            About FloodWatch PH
          </h1>
          <p className="mt-2 max-w-[940px] text-[1rem] leading-7 text-[var(--color-muted-foreground)]">
            A free, public flood-monitoring platform that helps everyone in the
            Philippines stay aware, stay prepared, and stay safe during the rainy
            season.
          </p>
        </section>

        <section className="rounded-[22px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-6 shadow-[var(--shadow-soft)]">
          <div className="flex flex-col gap-4 md:flex-row md:items-start">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-[16px] bg-[var(--color-primary)] text-white shadow-[0_18px_36px_rgba(37,99,235,0.18)]">
              <Waves className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-[1.1rem] font-semibold text-[var(--color-foreground)]">
                Our Mission
              </h2>
              <p className="mt-2 text-[1rem] leading-8 text-[var(--color-muted-foreground)]">
                Floods affect millions of Filipinos every year. FloodWatch PH brings
                together official advisories and community reports so the public can
                make fast, informed decisions — no account, login, or subscription
                required.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-[1.15rem] font-semibold text-[var(--color-foreground)]">
            How It Works
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-3">
            {STEP_CARDS.map((card) => (
              <article
                key={card.id}
                className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-[12px] bg-[rgba(37,99,235,0.1)] text-[var(--color-primary)]">
                  {card.icon}
                </div>
                <div className="mt-4 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-[var(--color-muted-foreground)]">
                  {card.step}
                </div>
                <h3 className="mt-4 text-[1rem] font-semibold text-[var(--color-foreground)]">
                  {card.title}
                </h3>
                <p className="mt-2 text-[0.98rem] leading-8 text-[var(--color-muted-foreground)]">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[1.15rem] font-semibold text-[var(--color-foreground)]">
            Understanding Flood Risk Levels
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {RISK_CARDS.map((card) => (
              <article
                key={card.id}
                className={`rounded-[20px] border bg-[var(--color-surface)] p-4 shadow-[var(--shadow-soft)] ${card.borderClassName}`}
              >
                <div className={`flex items-center gap-3 text-[1rem] font-semibold ${card.accentClassName}`}>
                  <span className={`h-4 w-4 rounded-[5px] ${card.dotClassName}`} />
                  <span>{card.label}</span>
                </div>
                <p className="mt-3 text-[0.96rem] leading-8 text-[var(--color-muted-foreground)]">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-[1.15rem] font-semibold text-[var(--color-foreground)]">
            What You Can Do Here
          </h2>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {FEATURE_CARDS.map((card) => (
              <article
                key={card.id}
                className="rounded-[20px] border border-[var(--color-border)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[rgba(37,99,235,0.1)] text-[var(--color-primary)]">
                    {card.icon}
                  </div>
                  <div>
                    <h3 className="text-[1rem] font-semibold text-[var(--color-foreground)]">
                      {card.title}
                    </h3>
                    <p className="mt-2 text-[1rem] leading-8 text-[var(--color-muted-foreground)]">
                      {card.description}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center gap-2 text-[var(--color-primary)]">
            <ShieldCheck className="h-5 w-5" />
            <h2 className="text-[1.15rem] font-semibold text-[var(--color-foreground)]">
              Data Sources
            </h2>
          </div>
          <p className="mt-4 text-[1rem] leading-8 text-[var(--color-muted-foreground)]">
            FloodWatch PH references public weather and emergency guidance together
            with community reports. Some public pages use representative sample data
            and should still be verified with official local sources.
          </p>

          <div className="mt-5 rounded-[18px] border border-[rgba(245,158,11,0.34)] bg-[rgba(245,158,11,0.08)] px-5 py-4 shadow-[var(--shadow-soft)]">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
              <p className="text-[0.98rem] leading-7 text-[var(--color-foreground)]">
                Data is for public awareness and should be verified with official
                authorities such as PAGASA, NDRRMC, and your local DRRMO.
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 text-center shadow-[var(--shadow-soft)]">
          <h2 className="text-[2rem] font-semibold tracking-[-0.03em] text-[var(--color-foreground)]">
            Seeing flooding in your area? Help others stay safe.
          </h2>
          <p className="mx-auto mt-4 max-w-[520px] text-[1rem] leading-8 text-[var(--color-muted-foreground)]">
            Submit a quick public report with the location, water level, and
            severity.
          </p>

          <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] bg-[var(--color-primary)] px-5 text-[0.94rem] font-semibold text-white shadow-[0_18px_36px_rgba(37,99,235,0.18)]"
            >
              <Megaphone className="h-4 w-4" />
              <span>Report Flood Incident</span>
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-[12px] border border-[var(--color-border)] bg-[var(--color-surface)] px-5 text-[0.94rem] font-semibold text-[var(--color-foreground)]"
            >
              <Map className="h-4 w-4" />
              <span>Open Flood Map</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
