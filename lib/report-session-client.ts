export const LEGACY_REPORT_SESSION_STORAGE_KEY = "community_report_session_hash";

let bootstrapPromise: Promise<void> | null = null;

function getLegacySessionHash() {
  try {
    return localStorage.getItem(LEGACY_REPORT_SESSION_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function clearLegacySessionHash() {
  try {
    localStorage.removeItem(LEGACY_REPORT_SESSION_STORAGE_KEY);
  } catch {
    // Browser privacy settings can deny local storage access.
  }
}

export function bootstrapReportSession() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const legacySessionHash = getLegacySessionHash();
      const response = await fetch("/api/report-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(legacySessionHash ? { legacySessionHash } : {}),
      });

      if (!response.ok) {
        throw new Error("Unable to initialize your report session.");
      }

      if (legacySessionHash) {
        clearLegacySessionHash();
      }
    })();
  }

  return bootstrapPromise;
}
