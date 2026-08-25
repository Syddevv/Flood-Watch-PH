import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type AuthButtonProps = {
  loading?: boolean;
  loadingLabel?: string;
  children: React.ReactNode;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children">;

export function AuthButton({
  loading,
  loadingLabel,
  children,
  className,
  disabled,
  type = "submit",
  ...rest
}: AuthButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "floodwatch-primary-action flex h-12 w-full items-center justify-center gap-2 rounded-[var(--radius-control)] text-[0.94rem] font-semibold transition-[filter,transform] duration-150 hover:brightness-105 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100 disabled:active:scale-100",
        className,
      )}
      {...rest}
    >
      {loading ? (
        <>
          <LoaderCircle className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />
          {loadingLabel ?? "Please wait..."}
        </>
      ) : (
        children
      )}
    </button>
  );
}
