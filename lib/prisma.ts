import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // For local development with SQLite, use BetterSqlite3 adapter
  // For Turso/production, the adapter is inferred from DATABASE_URL
  if (process.env.DATABASE_URL?.startsWith("libsql://")) {
    // Turso - Prisma handles this automatically
    return new PrismaClient();
  } else {
    // Local SQLite with BetterSqlite3 adapter
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as any;

    const dbPath = process.env.DATABASE_URL?.replace("file:", "") || "prisma/dev.db";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return new PrismaClient({ adapter } as any);
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
