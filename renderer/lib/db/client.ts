import { PrismaClient } from '@prisma/client'

// Singleton pattern prevents multiple PrismaClient instances in development
// where Next.js hot-reloads modules. In production a single instance is created.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
