export function successResponse<T>(data: T, init?: ResponseInit) {
  return Response.json({ data }, init);
}

export function errorResponse(message: string, status = 500, init?: ResponseInit) {
  return Response.json(
    {
      error: message,
    },
    {
      ...init,
      status,
    },
  );
}
