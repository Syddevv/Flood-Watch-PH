const DATABASE_UNAVAILABLE_CODES = new Set([
  "EACCES",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "P1001",
  "P1002",
  "P1008",
  "P1017",
  "P2024",
]);

export function isReportDatabaseUnavailableError(error: unknown) {
  if (typeof error === "object" && error && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && DATABASE_UNAVAILABLE_CODES.has(code)) {
      return true;
    }
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? (error as { message?: unknown }).message
        : "";

  return (
    typeof message === "string" &&
    /\b(connect\s+)?(EACCES|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|P1001|P1002|P1008|P1017|P2024)\b/i.test(
      message,
    )
  );
}
