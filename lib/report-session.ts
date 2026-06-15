export const REPORT_SESSION_STORAGE_KEY = "community_report_session_hash";
export const REPORT_SESSION_HEADER = "x-report-session-hash";
export const REPORT_ACTION_UNDO_WINDOW_MS = 30_000;

function generateSessionHash() {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

export function getReportSessionHash() {
  if (typeof window === "undefined") {
    return "";
  }

  try {
    const stored = localStorage.getItem(REPORT_SESSION_STORAGE_KEY);

    if (stored) {
      return stored;
    }

    const nextHash = generateSessionHash();
    localStorage.setItem(REPORT_SESSION_STORAGE_KEY, nextHash);
    return nextHash;
  } catch {
    return generateSessionHash();
  }
}

export function createReportActionHeaders(): Record<string, string> {
  const sessionHash = getReportSessionHash();

  if (!sessionHash) {
    return {};
  }

  return {
    [REPORT_SESSION_HEADER]: sessionHash,
  };
}

export function getReportSessionHashFromRequest(request: Request) {
  return request.headers.get(REPORT_SESSION_HEADER)?.trim() ?? "";
}
