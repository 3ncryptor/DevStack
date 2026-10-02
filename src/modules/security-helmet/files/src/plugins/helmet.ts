import helmet from '@fastify/helmet'
import type { FastifyInstance } from 'fastify'

/** Security headers on every response registered after it (Helmet's defaults). */
export async function registerHelmet(app: FastifyInstance): Promise<void> {
  await app.register(helmet)
}
