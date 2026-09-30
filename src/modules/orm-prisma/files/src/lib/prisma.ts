import { PrismaPg } from '@prisma/adapter-pg'

import { PrismaClient } from '../generated/prisma/client.js'

type PrismaGlobal = {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as unknown as PrismaGlobal

function createClient(): PrismaClient {
  // Prisma 7 connects through a driver adapter; the URL comes from the environment.
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
