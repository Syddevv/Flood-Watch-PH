import "server-only";

import { sendVerificationEmail, EmailDeliveryError } from "@/lib/email-delivery";
import {
  EMAIL_VERIFICATION_CODE_LIFETIME_MS,
  EMAIL_VERIFICATION_MAX_ATTEMPTS,
  EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
  generateEmailVerificationCode,
  getEmailVerificationKeys,
  getEmailVerificationState,
  hashEmailVerificationCode,
  verifyEmailVerificationCode,
} from "@/lib/email-verification-token";
import { prisma, type PrismaTransactionClient } from "@/lib/prisma";

function codeDates(now: Date) {
  return {
    expiresAt: new Date(now.getTime() + EMAIL_VERIFICATION_CODE_LIFETIME_MS),
    resendAvailableAt: new Date(
      now.getTime() + EMAIL_VERIFICATION_RESEND_COOLDOWN_MS,
    ),
  };
}

async function lockUserByEmail(tx: PrismaTransactionClient, email: string) {
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT "id"
    FROM "User"
    WHERE "email" = ${email}
    FOR UPDATE
  `;
  return rows[0]?.id ?? null;
}

async function recordDeliveryFailure(
  verificationId: string,
  error: unknown,
) {
  const safeCode =
    error instanceof EmailDeliveryError ? error.safeCode : "provider_request_failed";

  await prisma.emailVerification
    .update({
      where: { id: verificationId },
      data: {
        deliveryStatus: "failed",
        lastDeliveryAttemptAt: new Date(),
        lastDeliveryErrorCode: safeCode,
        // A failed provider request did not deliver a usable new code. Let the
        // resident retry immediately instead of enforcing a cooldown for mail
        // that never left the provider.
        resendAvailableAt: new Date(),
      },
    })
    .catch(() => undefined);
}

export async function createPendingRegistration(input: {
  email: string;
  passwordHash: string;
  displayName: string | null;
}) {
  const keys = getEmailVerificationKeys();
  const now = new Date();
  const dates = codeDates(now);

  const created = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.displayName,
        emailVerificationStatus: "pending",
      },
    });
    const code = generateEmailVerificationCode();
    const verification = await tx.emailVerification.create({
      data: {
        userId: user.id,
        codeHash: hashEmailVerificationCode(user.id, code, keys.current),
        keyId: keys.current.id,
        expiresAt: dates.expiresAt,
        resendAvailableAt: dates.resendAvailableAt,
        lastDeliveryAttemptAt: now,
      },
    });
    return { user, verification, code };
  });

  try {
    const delivery = await sendVerificationEmail({
      to: created.user.email,
      code: created.code,
      idempotencyKey: `registration-${created.verification.id}-v1`,
    });
    await prisma.emailVerification.update({
      where: { id: created.verification.id },
      data: {
        providerMessageId: delivery.messageId,
        deliveryStatus: "sent",
        lastDeliverySucceededAt: new Date(),
        lastDeliveryErrorCode: null,
      },
    });
    return { user: created.user, delivered: true } as const;
  } catch (error) {
    await recordDeliveryFailure(created.verification.id, error);
    return { user: created.user, delivered: false } as const;
  }
}

export async function requestVerificationEmail(email: string) {
  const candidate = await prisma.$transaction(async (tx) => {
    const userId = await lockUserByEmail(tx, email);
    if (!userId) return null;

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { emailVerification: true },
    });
    const verification = user?.emailVerification;
    const now = new Date();

    if (
      !user ||
      user.emailVerificationStatus !== "pending" ||
      !verification ||
      verification.resendAvailableAt.getTime() > now.getTime()
    ) {
      return null;
    }

    const keys = getEmailVerificationKeys();
    const nextVersion = verification.version + 1;
    const code = generateEmailVerificationCode(verification.version);
    const dates = codeDates(now);
    // Reserve this resend while the provider request is in flight. The old
    // hash remains usable until delivery succeeds, and a failed delivery
    // releases the reservation in recordDeliveryFailure.
    await tx.emailVerification.update({
      where: { id: verification.id },
      data: {
        resendAvailableAt: dates.resendAvailableAt,
        deliveryStatus: "pending",
        lastDeliveryAttemptAt: now,
        lastDeliveryErrorCode: null,
      },
    });
    return {
      userId: user.id,
      email: user.email,
      verificationId: verification.id,
      expectedVersion: verification.version,
      nextVersion,
      code,
      codeHash: hashEmailVerificationCode(user.id, code, keys.current),
      keyId: keys.current.id,
      ...dates,
    };
  });

  if (!candidate) return { outcome: "accepted" } as const;

  try {
    const delivery = await sendVerificationEmail({
      to: candidate.email,
      code: candidate.code,
      idempotencyKey: `verification-${candidate.verificationId}-v${candidate.nextVersion}`,
    });
    const updated = await prisma.emailVerification.updateMany({
      where: {
        id: candidate.verificationId,
        userId: candidate.userId,
        version: candidate.expectedVersion,
        consumedAt: null,
      },
      data: {
        codeHash: candidate.codeHash,
        keyId: candidate.keyId,
        expiresAt: candidate.expiresAt,
        attemptCount: 0,
        resendAvailableAt: candidate.resendAvailableAt,
        version: candidate.nextVersion,
        providerMessageId: delivery.messageId,
        deliveryStatus: "sent",
        lastDeliveryAttemptAt: new Date(),
        lastDeliverySucceededAt: new Date(),
        lastDeliveryErrorCode: null,
      },
    });
    return { outcome: updated.count === 1 ? "sent" : "accepted" } as const;
  } catch (error) {
    await recordDeliveryFailure(candidate.verificationId, error);
    return { outcome: "delivery_failed" } as const;
  }
}

export async function verifyPendingEmail(email: string, code: string) {
  return prisma.$transaction(async (tx) => {
    const userId = await lockUserByEmail(tx, email);
    if (!userId) return { outcome: "invalid" } as const;

    const user = await tx.user.findUnique({
      where: { id: userId },
      include: { emailVerification: true },
    });
    const verification = user?.emailVerification;

    if (!user || user.emailVerificationStatus !== "pending" || !verification) {
      return { outcome: "invalid" } as const;
    }

    const state = getEmailVerificationState(verification);
    if (state !== "active") return { outcome: state } as const;

    const keys = getEmailVerificationKeys();
    const valid = verifyEmailVerificationCode(
      user.id,
      code,
      verification.codeHash,
      verification.keyId,
      keys.all,
    );

    if (!valid) {
      const nextAttemptCount = verification.attemptCount + 1;
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: { attemptCount: nextAttemptCount },
      });
      return {
        outcome:
          nextAttemptCount >= EMAIL_VERIFICATION_MAX_ATTEMPTS
            ? ("exhausted" as const)
            : ("invalid" as const),
      };
    }

    const verifiedAt = new Date();
    await tx.emailVerification.update({
      where: { id: verification.id },
      data: { consumedAt: verifiedAt },
    });
    const verifiedUser = await tx.user.update({
      where: { id: user.id },
      data: {
        emailVerificationStatus: "verified",
        emailVerifiedAt: verifiedAt,
      },
    });

    return { outcome: "verified", user: verifiedUser } as const;
  });
}
