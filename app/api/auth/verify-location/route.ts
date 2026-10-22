import { errorResponse, successResponse } from "@/lib/api-response";
import { createRegistrationLocationVerification } from "@/lib/registration-location";
import { checkRegistrationLocation, registrationEmail, type LocationFix } from "@/lib/registration-policy";
import { protectApiRequest } from "@/lib/request-security";

export async function POST(request: Request) {
  const protection = await protectApiRequest(request, {
    scope: "auth-verify-location", limit: 8, windowMs: 60 * 60 * 1000, requireTrustedOrigin: true,
  });
  if (protection) return protection;
  const payload = await request.json().catch(() => null) as (LocationFix & { email?: unknown }) | null;
  const email = registrationEmail(payload?.email);
  if (!email || !payload) return errorResponse("Enter a valid email address before detecting your location.", 400);
  const status = checkRegistrationLocation(payload);
  if (status === "outside") return errorResponse("Registration is currently available only to residents registering from within Bulacan. Your current location appears to be outside our supported area.", 403);
  if (status !== "valid") return errorResponse("We couldn't verify your location accurately. Please move to an area with a stronger location signal and try again.", 400);
  try {
    const result = await createRegistrationLocationVerification(email, payload.latitude as number, payload.longitude as number);
    if (!result) return errorResponse("We couldn't retrieve a usable address. Please try detecting your location again.", 502);
    return successResponse(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return errorResponse("Location verification is temporarily unavailable. Please try again.", 503);
  }
}
