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
      const libsql = require("@libsql/client") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const libsqlAdapter = require("@prisma/adapter-libsql") as any;

      const createClient = libsql.createClient || libsql.default?.createClient;
      const client = createClient({ url: dbUrl });

      // Try different export patterns
      const AdapterConstructor = libsqlAdapter.PrismaLibSQL || libsqlAdapter.default || libsqlAdapter;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new AdapterConstructor(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter } as any);
    } else {
      // Local SQLite
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const betterSqlite = require("@prisma/adapter-better-sqlite3") as any;
      const AdapterConstructor = betterSqlite.PrismaBetterSqlite3 || betterSqlite.default;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = new AdapterConstructor({ url: dbUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter } as any);
    }
  } catch (error) {
    console.error("Failed to initialize Prisma with adapter:", error);
    // Fallback - try without adapter
    try {
      prismaInstance = new PrismaClient();
    } catch (fallbackError) {
      console.error("Fallback Prisma initialization also failed:", fallbackError);
      throw error;
    }
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
