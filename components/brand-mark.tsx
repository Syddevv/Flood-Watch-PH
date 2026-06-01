import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-8.5 w-8.5 overflow-hidden rounded-[16px] shadow-[0_10px_24px_rgba(37,99,235,0.18)]",
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
