import type { IncidentReport } from "@/lib/types";

export function buildPublicReportUrl(report: Pick<IncidentReport, "id">) {
  if (typeof window === "undefined") {
    return `/reports/${report.id}`;
  }

  return `${window.location.origin}/reports/${report.id}`;
}

export async function copyTextWithFallback(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy copy path.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);

  try {
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);
    return document.execCommand("copy");
  } finally {
    document.body.removeChild(textarea);
  }
}

export async function copyPublicReportUrl(report: Pick<IncidentReport, "id">) {
  return copyTextWithFallback(buildPublicReportUrl(report));
}
