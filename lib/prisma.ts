import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Lazy initialization - only create when first accessed
function createPrismaClient(): PrismaClient {
  try {
    return new PrismaClient();
  } catch (error) {
    // During build, database might not be reachable
    // Return a dummy client that will work at runtime
    console.warn("Prisma initialization deferred (normal during build)");
    return new PrismaClient({
      errorFormat: "pretty",
    });
  }
}

let cachedPrisma: PrismaClient | undefined;

export function getPrisma(): PrismaClient {
  if (!cachedPrisma) {
    cachedPrisma = createPrismaClient();
  }
  return cachedPrisma;
}

// Lazy proxy to defer initialization
export const prisma = new Proxy({} as any, {
  get: (_target, prop: string | symbol) => {
    const client = getPrisma();
    return Reflect.get(client, prop);
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = cachedPrisma;
}
