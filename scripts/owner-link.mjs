// Prints a one-time link that signs a browser into an existing (non-guest) user,
// e.g. the original profile created before guest accounts existed.
//
//   npm run owner-link                  # user 1, link for APP_URL or localhost
//   npm run owner-link -- 1 https://my-app.vercel.app
//
// The link is valid for 1 hour and works once. Only the token's hash is stored.
import { createHash, randomBytes } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const userId = Number(process.argv[2] ?? 1);
const base = (process.argv[3] ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const prisma = new PrismaClient();
try {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    console.error(`No user with id ${userId}.`);
    process.exit(1);
  }
  if (user.isGuest) console.warn(`Note: user ${userId} is a guest account and will expire when inactive.`);

  const token = randomBytes(32).toString("base64url");
  await prisma.session.create({
    data: { userId, tokenHash: createHash("sha256").update(token).digest("hex") },
  });
  console.log(`Sign-in link for "${user.name}" (user ${userId}), valid for 1 hour, single use:\n`);
  console.log(`  ${base}/signin/${token}\n`);
} finally {
  await prisma.$disconnect();
}
