import { PrismaClient } from "@prisma/client";

let cachedPrisma: PrismaClient | undefined;

export function getPrismaClient() {
  if (cachedPrisma) {
    return cachedPrisma;
  }

  cachedPrisma = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error"] : [],
  });

  return cachedPrisma;
}

// Export as a getter to avoid initialization at import time
export const prisma = new Proxy(
  {},
  {
    get: (_, prop) => Reflect.get(getPrismaClient(), prop),
  }
) as unknown as PrismaClient;
