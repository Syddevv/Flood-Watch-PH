import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { pausedRolloutFeature, ROLLOUT_PAUSE_MESSAGES } from "@/lib/rollout-gates";

export function proxy(request: NextRequest) {
  const requestId = randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const paused = pausedRolloutFeature(request.nextUrl.pathname, request.method);
  if (paused) {
    return NextResponse.json(
      { error: ROLLOUT_PAUSE_MESSAGES[paused], code: "FEATURE_PAUSED", requestId },
      { status: 503, headers: { "Cache-Control": "no-store", "x-request-id": requestId } },
    );
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = { matcher: ["/api/:path*", "/admin/:path*"] };
