import { PrismaClient } from "@prisma/client";

/**
 * Client Prisma unique.
 *
 * En développement, Next recharge les modules à chaud à chaque édition : sans ce
 * cache sur `globalThis`, chaque rechargement ouvrirait un nouveau pool de
 * connexions jusqu'à saturer PostgreSQL.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
