import { withRequestId } from "@/lib/structured-logger";

export async function GET(request: Request) {
  return withRequestId(Response.json({
    status: "ok",
    message: "Flood Watch backend is running",
  }), request);
}
