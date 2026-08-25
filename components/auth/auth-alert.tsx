import { AlertTriangle } from "lucide-react";

export function AuthAlert({ title, message }: { title: string; message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-[var(--radius-panel)] border border-[var(--color-danger-border)] bg-[var(--color-danger-surface)] px-3.5 py-3"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-danger-text)]" />
      <div>
        <div className="text-[0.86rem] font-semibold text-[var(--color-danger-text)]">
          {title}
        </div>
        <p className="mt-0.5 text-[0.82rem] leading-5 text-[var(--color-danger-text)]">
          {message}
        </p>
      </div>
    </div>
  );
}
