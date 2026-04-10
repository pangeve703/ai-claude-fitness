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
    // Only use adapters in production with Turso
    if (isProduction && dbUrl?.startsWith("libsql://")) {
      // Production: Turso with LibSQL adapter
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { createClient } = require("@libsql/client") as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = require("@prisma/adapter-libsql") as any;

      const client = createClient({ url: dbUrl });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const libsqlAdapter = new adapter.PrismaLibSQL(client);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      prismaInstance = new PrismaClient({ adapter: libsqlAdapter } as any);
    } else {
      // Development: always use local SQLite with BetterSqlite3
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
    throw error;
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
