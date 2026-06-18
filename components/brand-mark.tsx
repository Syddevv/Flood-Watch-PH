import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 overflow-hidden rounded-[12px] border border-[color:color-mix(in_srgb,var(--color-border)_72%,transparent)] bg-[var(--color-surface-raised)] shadow-[var(--shadow-primary)]",
        className,
      )}
    >
      <Image
        src="/FloodWatchPH Logo.png"
        alt="FloodWatch PH logo"
        fill
        sizes="34px"
        className="object-cover"
        priority
      />
    </div>
  );
}
