import { adminErrorResponse } from "@/lib/admin-api-response";
import { RescueError } from "@/lib/rescue-contracts";

export async function readRescueJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.startsWith("application/json")) throw new RescueError("Send JSON request data.", 400);
  const reader = request.body?.getReader();
  if (!reader) throw new RescueError("Request body is required.", 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 16_384) throw new RescueError("Request data is too large.", 413);
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks))); }
  catch { throw new RescueError("Invalid JSON request data.", 400); }
}

export function rescueApiError(request: Request, error: unknown) {
  if (error instanceof RescueError) return adminErrorResponse(request, error.message, error.status);
  // Database errors can include row values; never log contact, location or needs.
  console.error("Rescue API persistence failure", error instanceof Error ? error.name : "unknown");
  return adminErrorResponse(request, "Rescue service is temporarily unavailable.", 503);
}
