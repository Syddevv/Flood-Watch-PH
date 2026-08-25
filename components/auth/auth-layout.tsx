import Link from "next/link";
import { ArrowLeft, CloudRain, MapPin, ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";
import { HEADER_SUBTITLE } from "@/lib/constants";

const FEATURE_BULLETS = [
  { icon: CloudRain, label: "Live community flood reports" },
  { icon: MapPin, label: "Verified evacuation center locations" },
  { icon: ShieldCheck, label: "Built for Philippine communities" },
];

function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0b1220] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
      {/* Subtle topographic contour texture. Purely decorative. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.07]"
        viewBox="0 0 600 800"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        {[80, 160, 240, 320, 400, 480, 560, 640, 720].map((y, index) => (
          <path
            key={y}
            d={`M -50 ${y} C 100 ${y - 40 - index * 4}, 200 ${y + 40 + index * 4}, 350 ${y - 20}, S 650 ${y + 10}, 700 ${y}`}
            stroke="#7dd3fc"
            strokeWidth="1.4"
          />
        ))}
      </svg>
      <div
        className="pointer-events-none absolute -left-24 -top-24 h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.35),transparent_70%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute bottom-[-140px] right-[-100px] h-[380px] w-[380px] rounded-full bg-[radial-gradient(circle,rgba(56,189,248,0.18),transparent_70%)]"
        aria-hidden="true"
      />

      <div className="relative flex items-center gap-2.5">
        <BrandMark className="h-9 w-9 shrink-0" />
        <div>
          <div className="text-[0.95rem] font-semibold tracking-[-0.02em] text-white">
            FloodWatch PH
          </div>
          <div className="text-[0.7rem] leading-none text-slate-400">{HEADER_SUBTITLE}</div>
        </div>
      </div>

      <div className="relative max-w-md">
        <h2 className="text-[2.1rem] font-semibold leading-[1.15] tracking-[-0.02em] text-white xl:text-[2.35rem]">
          Stay informed.
          <br />
          Stay prepared.
        </h2>
        <p className="mt-4 text-[0.95rem] leading-7 text-slate-300">
          FloodWatch PH brings community flood reports, evacuation centers, and weather updates
          together in one interactive map.
        </p>

        <ul className="mt-8 space-y-3">
          {FEATURE_BULLETS.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-2.5 text-[0.86rem] text-slate-300">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10">
                <Icon className="h-3.5 w-3.5 text-sky-300" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <p className="relative text-[0.72rem] text-slate-500">
        &copy; {new Date().getFullYear()} FloodWatch PH. Community flood monitoring.
      </p>
    </div>
  );
}

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[var(--color-background)] lg:grid lg:grid-cols-2">
      <AuthBrandPanel />

      <div className="flex min-h-screen flex-col justify-center px-5 py-10 sm:px-8 md:px-12 lg:px-12 lg:py-12 xl:px-20">
        <div className="mx-auto w-full max-w-[420px]">
          <div className="mb-6 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2">
              <BrandMark className="h-8 w-8" />
              <span className="text-[0.9rem] font-semibold tracking-[-0.02em] text-[var(--color-foreground)]">
                FloodWatch PH
              </span>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[0.82rem] font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to FloodWatch PH
          </Link>

          <div className="floodwatch-auth-card-in mt-5 rounded-[var(--radius-card)] border border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-8 shadow-[var(--shadow-soft)] sm:px-9 sm:py-10">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
