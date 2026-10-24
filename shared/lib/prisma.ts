import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/prisma/generated/prisma/client'

/**
 * Prisma 7 runs engine-less through the `@prisma/adapter-pg` driver adapter.
 * The client is cached on `globalThis` in development so Next.js hot-reload
 * does not open a new connection pool on every edit.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
