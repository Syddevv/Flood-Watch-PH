type LogContext = Record<string, unknown>;

function getRequestPath(request: Request) {
  try {
    return new URL(request.url).pathname;
  } catch {
    return "unknown";
  }
}

export function getRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || "unknown";
}

export function logApiError(
  event: string,
  request: Request,
  error: unknown,
  context: LogContext = {},
) {
  const errorDetails =
    error instanceof Error
      ? { name: error.name, message: error.message }
      : { name: "UnknownError", message: String(error) };

  console.error(
    JSON.stringify({
      level: "error",
      event,
      requestId: getRequestId(request),
      method: request.method,
      path: getRequestPath(request),
      ...context,
      error: errorDetails,
    }),
  );
}

export function withRequestId(response: Response, request: Request) {
  const requestId = getRequestId(request);
  if (requestId === "unknown") return response;

  const headers = new Headers(response.headers);
  headers.set("x-request-id", requestId);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
