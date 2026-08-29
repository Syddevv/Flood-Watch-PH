import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { isValidEmail } from "@/lib/validations";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !isValidEmail(email)) { console.error("Usage: npm run admin:promote -- admin@example.com"); process.exit(1); }
const user = await prisma.user.findUnique({ where: { email } });
if (!user) { console.error("No account exists for that email."); await prisma.$disconnect(); process.exit(1); }
if (user.role === "admin") { console.log("Account is already an administrator."); await prisma.$disconnect(); process.exit(0); }
await prisma.$transaction(async (tx) => {
  await tx.user.update({ where: { id: user.id }, data: { role: "admin" } });
  await tx.session.deleteMany({ where: { userId: user.id } });
  await tx.adminAuditLog.create({ data: { action: "ADMIN_ROLE_GRANTED", targetType: "User", targetId: user.id, metadata: { email, source: "cli" } } });
});
console.log("Administrator role granted and existing sessions revoked.");
await prisma.$disconnect();
