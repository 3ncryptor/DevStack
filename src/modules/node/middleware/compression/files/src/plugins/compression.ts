import compress from '@fastify/compress'
import type { FastifyInstance } from 'fastify'

/** gzip, deflate or brotli, as the client accepts. */
export async function registerCompression(app: FastifyInstance): Promise<void> {
  await app.register(compress)
}
