import { PrismaClient } from '@prisma/client'

type PrismaGlobal = {
  prisma?: PrismaClient
}

const globalForPrisma = globalThis as unknown as PrismaGlobal

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
