import { PrismaClient } from '@prisma/client'

// Prisma recommends a singleton pattern in Next.js to avoid exhausting the
// connection pool during hot-module replacement in development.
// In production there is only one process, so the global is never re-used.

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
