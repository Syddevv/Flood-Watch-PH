import { Waves } from "lucide-react";

import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-8.5 w-8.5 items-center justify-center rounded-[16px] bg-[var(--color-primary)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.28)]",
        className,
      )}
    >
      <Waves className="h-4 w-4" strokeWidth={2.15} />
    </div>
  );
}
