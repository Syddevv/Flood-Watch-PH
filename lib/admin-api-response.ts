import { randomUUID } from "node:crypto";

function getOrCreateRequestId(request: Request) {
  return request.headers.get("x-request-id")?.trim() || randomUUID();
}

function responseHeaders(requestId: string, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("x-request-id", requestId);
  headers.set("Cache-Control", "no-store");
  return headers;
}

export function adminSuccessResponse<T>(
  request: Request,
  data: T,
  init?: ResponseInit,
) {
  const requestId = getOrCreateRequestId(request);
  return Response.json(
    { data, error: null, requestId },
    { ...init, headers: responseHeaders(requestId, init) },
  );
}

export function adminErrorResponse(
  request: Request,
  message: string,
  status = 500,
  init?: ResponseInit,
) {
  const requestId = getOrCreateRequestId(request);
  return Response.json(
    { data: null, error: message, requestId },
    { ...init, status, headers: responseHeaders(requestId, init) },
  );
}
