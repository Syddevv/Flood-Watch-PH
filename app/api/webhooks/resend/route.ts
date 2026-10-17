import { prisma } from "@/lib/prisma";
import { getResendDeliveryUpdate, verifyResendWebhook } from "@/lib/resend-webhook";

export async function POST(request: Request) {
  const body = await request.text();
  const valid = verifyResendWebhook({
    body,
    id: request.headers.get("svix-id"),
    timestamp: request.headers.get("svix-timestamp"),
    signature: request.headers.get("svix-signature"),
    secret: process.env.RESEND_WEBHOOK_SECRET,
  });
  if (!valid) return new Response(null, { status: 401 });

  let event: {
    type?: unknown;
    data?: { email_id?: unknown };
  };
  try {
    event = JSON.parse(body) as typeof event;
  } catch {
    return Response.json({ error: "Invalid webhook payload." }, { status: 400 });
  }
  const deliveryStatus =
    typeof event.type === "string" ? getResendDeliveryUpdate(event.type) : null;
  const providerMessageId = event.data?.email_id;

  if (deliveryStatus && typeof providerMessageId === "string") {
    await prisma.emailVerification.updateMany({
      where: { providerMessageId },
      data: { deliveryStatus },
    });
  }

  return Response.json({ received: true });
}
