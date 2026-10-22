import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const DESKTOP_WAVE = "M47 -4C22 60 19 117 37 178C56 243 48 279 29 338C12 392 25 449 43 505C65 574 58 606 35 667C24 703 25 737 39 764";
const MOBILE_WAVE = "M-4 22C105 3 165 12 252 28C337 43 391 27 465 15C541 2 590 8 657 21C742 37 809 18 891 12C945 8 980 15 1004 22";

function AuthBrandPanel() {
  return (
    <div className="relative isolate flex min-h-[184px] flex-col items-center justify-center overflow-hidden bg-[linear-gradient(145deg,#07366e_0%,#1265b8_55%,#084586_100%)] px-6 pb-9 pt-5 text-center text-white lg:min-h-0 lg:px-12 lg:py-12">
      <div className="pointer-events-none absolute -left-24 -top-40 size-[390px] rounded-full bg-sky-300/10 blur-3xl lg:size-[530px]" aria-hidden="true" />
      <div className="pointer-events-none absolute -bottom-52 -right-32 size-[380px] rounded-full bg-[#82cfff]/15 blur-3xl lg:size-[520px]" aria-hidden="true" />
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-25"
        viewBox="0 0 500 760"
        fill="none"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <path d="M-120 484C-2 430 89 542 217 487S429 420 618 484" stroke="#b7e7ff" strokeWidth="1.5" />
        <path d="M-120 519C-2 465 89 577 217 522S429 455 618 519" stroke="#b7e7ff" strokeWidth="1.2" />
        <path d="M-120 554C-2 500 89 612 217 557S429 490 618 554" stroke="#b7e7ff" strokeWidth="1" />
      </svg>

      <div className="relative z-10 flex flex-col items-center">
        <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-sky-100/80 lg:block">Welcome to</p>
        <Link
          href="/"
          className="mt-0 rounded-full focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white lg:mt-6"
          aria-label="Flood Watch home"
        >
          <BrandMark className="size-[84px] drop-shadow-[0_12px_24px_rgba(2,16,47,0.35)] lg:size-[132px]" sizes="(min-width: 1024px) 132px, 84px" />
        </Link>
        <h2 className="mt-1 text-[1.15rem] font-semibold tracking-tight lg:mt-8 lg:text-[2.35rem] lg:leading-[1.15]">
          Stay informed. <span className="whitespace-nowrap">Stay prepared.</span>
        </h2>
        <p className="mt-4 hidden max-w-[330px] text-sm leading-6 text-sky-50/85 lg:block">
          Flood reports, local conditions, and evacuation information for communities across Bulacan.
        </p>
      </div>

      <p className="absolute bottom-8 left-0 right-0 hidden text-xs text-sky-100/65 lg:block">
        Bulacan, Philippines
      </p>

      <svg className="pointer-events-none absolute bottom-[-1px] left-0 h-9 w-full lg:hidden" viewBox="0 0 1000 60" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="auth-wave-glow-mobile" x="-10%" y="-100%" width="120%" height="300%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
          <linearGradient id="auth-wave-edge-mobile" x1="0" y1="0" x2="1" y2="0">
            <stop stopColor="#cceeff" stopOpacity="0.14" />
            <stop offset="0.46" stopColor="#f1fbff" stopOpacity="0.32" />
            <stop offset="1" stopColor="#b7e7ff" stopOpacity="0.17" />
          </linearGradient>
        </defs>
        <path d={MOBILE_WAVE} fill="none" stroke="#a4e4ff" strokeOpacity="0.18" strokeWidth="14" filter="url(#auth-wave-glow-mobile)" />
        <path d={MOBILE_WAVE} fill="none" stroke="#b9ebff" strokeOpacity="0.12" strokeWidth="5" />
        <path d={`${MOBILE_WAVE}L1004 60H-4Z`} fill="var(--color-surface)" />
        <path d={MOBILE_WAVE} fill="none" stroke="url(#auth-wave-edge-mobile)" strokeWidth="1.2" />
      </svg>
      <svg className="pointer-events-none absolute right-[-1px] top-0 hidden h-full w-[74px] lg:block" viewBox="0 0 74 760" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <filter id="auth-wave-glow-desktop" x="-100%" y="-10%" width="300%" height="120%">
            <feGaussianBlur stdDeviation="7" />
          </filter>
          <linearGradient id="auth-wave-edge-desktop" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#cceeff" stopOpacity="0.14" />
            <stop offset="0.38" stopColor="#f1fbff" stopOpacity="0.34" />
            <stop offset="0.74" stopColor="#b7e7ff" stopOpacity="0.18" />
            <stop offset="1" stopColor="#e0f5ff" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d={DESKTOP_WAVE} fill="none" stroke="#a4e4ff" strokeOpacity="0.18" strokeWidth="18" filter="url(#auth-wave-glow-desktop)" />
        <path d={DESKTOP_WAVE} fill="none" stroke="#b9ebff" strokeOpacity="0.11" strokeWidth="6" />
        <path d={`${DESKTOP_WAVE}L74 764V-4Z`} fill="var(--color-surface)" />
        <path d={DESKTOP_WAVE} fill="none" stroke="url(#auth-wave-edge-desktop)" strokeWidth="1.2" />
      </svg>
    </div>
  );
}

export function AuthLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#071327] px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
      <div className="grid w-full max-w-[1120px] overflow-hidden rounded-[28px] border border-white/10 bg-[var(--color-surface)] shadow-[0_32px_90px_rgba(0,0,0,0.28)] lg:h-[min(760px,calc(100dvh-3rem))] lg:min-h-[560px] lg:grid-cols-[44%_56%]">
        <AuthBrandPanel />

        <div className="min-w-0 bg-[var(--color-surface)] lg:min-h-0 lg:overflow-y-auto">
          <div className={`floodwatch-auth-card-in mx-auto flex min-h-full w-full flex-col justify-center px-6 pb-9 pt-5 sm:px-10 sm:pb-12 sm:pt-8 lg:px-11 lg:py-12 xl:px-14 ${wide ? "max-w-[590px]" : "max-w-[530px]"}`}>
            <Link
              href="/"
              className="mb-5 inline-flex min-h-10 w-fit items-center gap-2 text-sm font-medium text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)] lg:mb-7"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to Flood Watch
            </Link>
            {children}
          </div>
        </div>
      </div>
    </main>
  );
}
