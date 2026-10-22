import Image from "next/image";

import { cn } from "@/lib/utils";

export function BrandMark({ className, sizes = "36px" }: { className?: string; sizes?: string }) {
  return (
    <div
      className={cn(
        "relative h-9 w-9 shrink-0",
        className,
      )}
    >
      <Image
        src="/Flood Watch Warning Emblem.png"
        alt="Flood Watch logo"
        fill
        sizes={sizes}
        className="object-contain"
        priority
      />
    </div>
  );
}
