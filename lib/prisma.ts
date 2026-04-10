import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient | undefined;

export function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const dbUrl = process.env.DATABASE_URL;
  const isProduction = process.env.NODE_ENV === "production";

  try {
    if (isProduction && dbUrl?.startsWith("libsql://")) {
      // Production: Use LibSQL adapter for Turso
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const libsql = require("@libsql/client") as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const libsqlAdapter = require("@prisma/adapter-libsql") as any;

        const client = libsql.createClient({ url: dbUrl });
        // Try both possible export patterns
        const Adapter = libsqlAdapter.PrismaLibSQL || libsqlAdapter.default?.PrismaLibSQL || libsqlAdapter;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adapter = new Adapter(client);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prismaInstance = new PrismaClient({ adapter } as any);
      } catch (adapterError) {
        console.warn("Failed to initialize LibSQL adapter, attempting direct instantiation:", adapterError);
        // If adapter fails, fall back to trying direct URL
        prismaInstance = new PrismaClient();
      }
    } else {
      // Development: Always use local SQLite with BetterSqlite3
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = require("@prisma/adapter-better-sqlite3") as any;
      const localDbUrl = "file:./prisma/dev.db";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const sqliteAdapter = new adapter.PrismaBetterSqlite3({ url: localDbUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter: sqliteAdapter } as any);
    }
  } catch (error) {
    console.error("Prisma initialization error:", error);
    // Last resort: create without adapter (may fail but won't crash during require)
    try {
      prismaInstance = new PrismaClient();
    } catch {
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
