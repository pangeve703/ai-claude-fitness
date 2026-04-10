import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const isLocalDb = process.env.DATABASE_URL?.startsWith("file:");

  if (isLocalDb) {
    // Local SQLite with BetterSqlite3 adapter
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return new PrismaClient({ adapter } as any);
    } catch (e) {
      console.warn("BetterSqlite3 adapter failed, using default client");
    }
  }

  // PostgreSQL or fallback
  return new PrismaClient();
}

let cachedPrisma: PrismaClient | undefined;

function getPrismaClient(): PrismaClient {
  if (cachedPrisma) return cachedPrisma;
  cachedPrisma = createPrismaClient();
  return cachedPrisma;
}

// Lazy initialization via proxy
export const prisma = new Proxy({} as any, {
  get: (_, prop) => Reflect.get(getPrismaClient(), prop),
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = cachedPrisma;
}
