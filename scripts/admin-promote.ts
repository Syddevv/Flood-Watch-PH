import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validations";

const email = process.argv[2]?.trim().toLowerCase();

async function main() {
  if (!email || !isValidEmail(email)) {
    console.error("Usage: npm run admin:promote -- admin@example.com");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    console.error("No account exists for that email.");
    process.exitCode = 1;
    return;
  }

  if (user.role === "admin") {
    console.log("Account is already an administrator.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role: "admin" } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.adminAuditLog.create({
      data: {
        action: "ADMIN_ROLE_GRANTED",
        targetType: "User",
        targetId: user.id,
        metadata: { email, source: "cli" },
      },
    });
  });
  console.log("Administrator role granted and existing sessions revoked.");
}

main()
  .catch((error) => {
    console.error("Failed to promote administrator account.", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
