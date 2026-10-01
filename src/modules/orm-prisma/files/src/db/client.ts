import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'

/** One client per process. Prisma 7 connects through the pg driver adapter (B17.3). */
export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})

/** Readiness check: the database answers a trivial query. */
export async function checkDatabase(): Promise<void> {
  await prisma.$queryRaw`SELECT 1`
}

/** Shutdown: close the pool so the process does not wait on idle connections. */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect()
}
