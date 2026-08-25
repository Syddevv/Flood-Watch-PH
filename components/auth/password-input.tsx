"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { AuthInput } from "@/components/auth/auth-input";

type PasswordInputProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  minLength?: number;
};

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  autoComplete = "current-password",
  required,
  error,
  hint,
  minLength,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthInput
      id={id}
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={onChange}
      autoComplete={autoComplete}
      required={required}
      error={error}
      hint={hint}
      minLength={minLength}
      rightElement={
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--color-muted-foreground)] transition-colors hover:text-[var(--color-foreground)] focus-visible:text-[var(--color-foreground)] focus-visible:outline-none"
        >
          {visible ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
        </button>
      }
    />
  );
}
