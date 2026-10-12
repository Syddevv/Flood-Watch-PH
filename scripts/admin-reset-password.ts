import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { hashPassword, isValidPasswordLength } from "@/lib/password";
import { isValidEmail } from "@/lib/validations";

const email = process.argv[2]?.trim().toLowerCase();

function readHidden(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error("Run this command in an interactive terminal.");
  }

  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  return new Promise((resolve, reject) => {
    let value = "";

    function finish(error?: Error) {
      process.stdin.removeListener("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      if (error) reject(error);
      else resolve(value);
    }

    function onData(chunk: string) {
      for (const character of chunk) {
        if (character === "\r" || character === "\n") {
          finish();
          return;
        }
        if (character === "\u0003") {
          finish(new Error("Password reset cancelled."));
          return;
        }
        if (character === "\u007f" || character === "\b") {
          const characters = Array.from(value);
          if (characters.length > 0) {
            characters.pop();
            value = characters.join("");
            process.stdout.write("\b \b");
          }
        } else if (character >= " ") {
          value += character;
          process.stdout.write("*");
        }
      }
    }

    process.stdin.on("data", onData);
  });
}

async function main() {
  if (!email || !isValidEmail(email)) {
    console.error("Usage: npm run admin:reset-password -- admin@example.com");
    process.exitCode = 1;
    return;
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });
  if (!user || user.role !== "admin") {
    console.error("No administrator account exists for that email.");
    process.exitCode = 1;
    return;
  }

  const password = await readHidden("New password (10–200 characters): ");
  if (!isValidPasswordLength(password)) {
    console.error("Password must be between 10 and 200 characters.");
    process.exitCode = 1;
    return;
  }
  const confirmation = await readHidden("Confirm new password: ");
  if (password !== confirmation) {
    console.error("Passwords do not match.");
    process.exitCode = 1;
    return;
  }

  const passwordHash = await hashPassword(password);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { passwordHash } });
    await tx.session.deleteMany({ where: { userId: user.id } });
    await tx.adminAuditLog.create({
      data: {
        action: "ADMIN_PASSWORD_RESET",
        targetType: "User",
        targetId: user.id,
        metadata: { email, source: "cli" },
      },
    });
  });

  console.log("Administrator password updated. Existing sessions were signed out.");
}

main()
  .catch(() => {
    console.error("Could not reset the administrator password.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
