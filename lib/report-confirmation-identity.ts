import { createHash } from "node:crypto";

/** Stable account key for the existing unique confirmation slot. */
export function accountConfirmationKey(userId: string) {
  return createHash("sha256").update(`account-confirmation:${userId}`).digest("hex");
}
