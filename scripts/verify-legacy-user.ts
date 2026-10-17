import "dotenv/config";

import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validations";

const email = process.argv[2]?.trim().toLowerCase();
const allowAdmin = process.argv.includes("--allow-admin");

async function main() {
  if (!email || !isValidEmail(email)) {
    console.error(
      "Usage: npm run user:verify-legacy -- user@example.com [--allow-admin]",
    );
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("No account exists for that email.");
    process.exitCode = 1;
    return;
  }

  if (user.emailVerificationStatus === "verified") {
    console.log("Account email is already verified.");
    return;
  }

  if (!user.emailVerificationStatus.startsWith("legacy_")) {
    console.error("Only migrated legacy accounts can be reviewed with this command.");
    process.exitCode = 1;
    return;
  }

  if (user.role === "admin" && !allowAdmin) {
    console.error(
      "Administrator verification requires an explicit --allow-admin review flag.",
    );
    process.exitCode = 1;
    return;
  }

  const verifiedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: { emailVerificationStatus: "verified", emailVerifiedAt: verifiedAt },
    });
    await tx.adminAuditLog.create({
      data: {
        action: "LEGACY_EMAIL_VERIFIED",
        targetType: "User",
        targetId: user.id,
        metadata: {
          email,
          role: user.role,
          source: "verify-legacy-user-cli",
        },
      },
    });
  });

  console.log("Legacy account email marked verified and audit event recorded.");
}

main()
  .catch((error) => {
    console.error("Failed to verify the legacy account.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
