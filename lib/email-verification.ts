import "server-only";

import {
  sendVerificationEmail,
  EmailDeliveryError,
  isAmbiguousEmailDeliveryError,
} from "@/lib/email-delivery";
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
  const ambiguous = isAmbiguousEmailDeliveryError(error);

  await prisma.emailVerification
    .update({
      where: { id: verificationId },
      data: {
        deliveryStatus: ambiguous ? "pending" : "failed",
        lastDeliveryAttemptAt: new Date(),
        lastDeliveryErrorCode: safeCode,
        // A definitive rejection can be retried immediately. A timeout or
        // network failure may have happened after EmailJS accepted the message,
        // so retain the cooldown instead of risking an immediate duplicate.
        ...(ambiguous ? {} : { resendAvailableAt: new Date() }),
      },
    })
    .catch(() => undefined);
}

export async function createPendingRegistration(input: {
  email: string;
  passwordHash: string;
  fullName: string;
  locationToken: string;
  streetAddress: string | null;
}) {
  const keys = getEmailVerificationKeys();
  const now = new Date();
  const dates = codeDates(now);

  const created = await prisma.$transaction(async (tx) => {
    const verificationNow = new Date();
    const location = await tx.registrationLocationVerification.findUnique({ where: { id: input.locationToken } });
    if (!location || location.email !== input.email || location.expiresAt <= verificationNow) {
      throw new Error("REGISTRATION_LOCATION_EXPIRED");
    }
    const consumed = await tx.registrationLocationVerification.deleteMany({
      where: { id: input.locationToken, email: input.email, expiresAt: { gt: verificationNow } },
    });
    if (consumed.count !== 1) throw new Error("REGISTRATION_LOCATION_EXPIRED");
    const streetAddress = location.streetAddress ?? input.streetAddress;
    const fullAddress = [streetAddress, location.barangay, location.cityMunicipality, "Bulacan", location.postalCode, "Philippines"].filter(Boolean).join(", ");
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash: input.passwordHash,
        displayName: input.fullName,
        fullName: input.fullName,
        fullAddress,
        streetAddress,
        barangay: location.barangay,
        cityMunicipality: location.cityMunicipality,
        province: "Bulacan",
        postalCode: location.postalCode,
        country: "Philippines",
        locationVerificationStatus: "verified",
        locationVerifiedAt: location.verifiedAt,
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
      toName: created.user.displayName,
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
    // hash remains usable until EmailJS accepts the request. A definitive
    // rejection releases the reservation; an ambiguous timeout promotes the
    // possibly delivered new code below while retaining the cooldown.
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
      displayName: user.displayName,
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
      toName: candidate.displayName,
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
    if (isAmbiguousEmailDeliveryError(error)) {
      // EmailJS has no idempotency key or request-status lookup. If the request
      // timed out after acceptance, the new code may already be in the user's
      // inbox. Make that code usable while retaining the normal cooldown; if
      // it was not accepted, the resident can request another code afterward.
      await prisma.emailVerification.updateMany({
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
          providerMessageId: null,
          deliveryStatus: "pending",
          lastDeliveryAttemptAt: new Date(),
          lastDeliveryErrorCode: error.safeCode,
        },
      });
      return { outcome: "delivery_failed" } as const;
    }
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
