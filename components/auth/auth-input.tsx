import { AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";

type AuthInputProps = {
  id: string;
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  optional?: boolean;
  maxLength?: number;
  minLength?: number;
  rightElement?: React.ReactNode;
  inputClassName?: string;
};

export function AuthInput({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder,
  autoComplete,
  required,
  error,
  hint,
  optional,
  maxLength,
  minLength,
  rightElement,
  inputClassName,
}: AuthInputProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label
          htmlFor={id}
          className="text-[0.78rem] font-medium text-[var(--color-muted-foreground)]"
        >
          {label}
        </label>
        {optional ? (
          <span className="text-[0.7rem] font-medium text-[var(--color-muted-foreground)]">
            Optional
          </span>
        ) : null}
      </div>

      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          maxLength={maxLength}
          minLength={minLength}
          aria-invalid={Boolean(error)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}
          className={cn(
            "h-12 w-full rounded-[var(--radius-control)] border bg-[var(--color-surface)] px-3.5 text-[0.94rem] text-[var(--color-foreground)] outline-none transition-colors duration-150 placeholder:text-[color:color-mix(in_srgb,var(--color-muted-foreground)_70%,transparent)] focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--color-primary)_20%,transparent)]",
            error
              ? "border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[color:color-mix(in_srgb,var(--color-danger)_18%,transparent)]"
              : "border-[var(--color-border)]",
            rightElement && "pr-11",
            inputClassName,
          )}
        />
        {rightElement}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="flex items-center gap-1.5 text-[0.8rem] text-[var(--color-danger)]"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[0.78rem] text-[var(--color-muted-foreground)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
