import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  // Initialize on first use
  const dbUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";

  try {
    if (dbUrl.startsWith("libsql://")) {
      // Turso
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { createClient } = require("@libsql/client") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { PrismaLibSQL } = require("@prisma/adapter-libsql") as any;

      const client = createClient({ url: dbUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new PrismaLibSQL(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter } as any);
    } else {
      // Local SQLite
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new PrismaBetterSqlite3({ url: dbUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter } as any);
    }
  } catch (error) {
    console.error("Failed to initialize Prisma:", error);
    // Fallback
    prismaInstance = new PrismaClient();
  }

  return prismaInstance;
}

// For backwards compatibility, export a lazy proxy
export const prisma = new Proxy({} as any, {
  get(_target, prop: string | symbol) {
    const client = getPrismaClient();
    return Reflect.get(client, prop);
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prismaInstance;
}
