import Link from "next/link";
import { ArrowLeft, CloudRain, MapPin, CloudSun } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const FEATURE_BULLETS = [
  { icon: CloudRain, label: "Community flood reports" },
  { icon: MapPin, label: "Evacuation center directory" },
  { icon: CloudSun, label: "Bulacan weather monitoring" },
];

function AuthBrandPanel() {
  return (
    <div className="relative hidden overflow-hidden bg-[#0b1528] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:min-h-[600px] lg:flex-col lg:px-10 lg:py-10 xl:px-16 xl:py-12">
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.09]"
        viewBox="0 0 600 800"
        fill="none"
        aria-hidden="true"
        preserveAspectRatio="xMidYMid slice"
      >
        {[90, 220, 350, 480, 610, 740].map((y, index) => (
          <path
            key={y}
            d={`M -50 ${y} C 120 ${y - 34 - index * 3}, 230 ${y + 25}, 360 ${y - 12}, S 650 ${y + 8}, 700 ${y}`}
            stroke="#7dd3fc"
            strokeWidth="1.4"
          />
        ))}
      </svg>
      <div className="relative mx-auto flex h-full w-full max-w-[520px] flex-col">
        <Link href="/" className="w-fit rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-sky-400" aria-label="Flood Watch home">
          <BrandMark className="h-[76px] w-[76px]" sizes="76px" />
        </Link>
        <div className="my-auto max-w-[470px] py-12">
          <h2 className="text-[clamp(2.7rem,3.7vw,4rem)] font-semibold leading-[1.08] tracking-[-0.04em] text-white">
            Stay informed.
            <br />
            Stay prepared.
          </h2>
          <p className="mt-6 max-w-[410px] text-base leading-7 text-slate-300">
            Stay connected to flood reports, weather conditions, and evacuation information across Bulacan.
          </p>

          <ul className="mt-9 space-y-4">
            {FEATURE_BULLETS.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-slate-200">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-sky-300/15 bg-sky-300/10">
                  <Icon className="h-4 w-4 text-sky-300" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          &copy; {new Date().getFullYear()} Flood Watch. Community flood monitoring.
        </p>
      </div>
    </div>
  );
}

export function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="min-h-dvh bg-[var(--color-background)] lg:grid lg:grid-cols-[48%_52%] lg:bg-[#0b1528]">
      <AuthBrandPanel />

      <div className="flex min-h-dvh min-w-0 flex-col justify-start bg-[var(--color-background)] px-5 py-8 sm:px-8 sm:py-10 lg:justify-center lg:px-8 xl:px-12">
        <div className={`mx-auto w-full ${wide ? "max-w-[620px]" : "max-w-[500px]"}`}>
          <div className="mb-7 flex items-center lg:hidden">
            <Link href="/" className="flex items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-primary)]" aria-label="Flood Watch home">
              <BrandMark className="h-16 w-16" sizes="64px" />
            </Link>
          </div>

          <Link
            href="/"
            className="inline-flex min-h-10 items-center gap-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Flood Watch
          </Link>

          <div className="floodwatch-auth-card-in mt-5 rounded-2xl border-0 bg-transparent px-0 py-0 shadow-none sm:border sm:border-[var(--color-border)] sm:bg-[var(--color-surface)] sm:px-8 sm:py-9 sm:shadow-[var(--shadow-soft)] xl:px-10 xl:py-10">
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
