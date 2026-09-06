export function getSafeLocalRedirect(value: string | null | undefined, fallback: string) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || /[\u0000-\u001f\u007f]/.test(value)) return fallback;
  try {
    const parsed = new URL(value, "http://floodwatch.local");
    return parsed.origin === "http://floodwatch.local" ? value : fallback;
  } catch {
    return fallback;
  }
}
