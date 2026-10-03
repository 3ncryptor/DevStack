import cors from '@fastify/cors'
import type { FastifyInstance } from 'fastify'

function parseAllowedOrigins(): string[] {
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? ''
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const allowedOrigins = parseAllowedOrigins()

if (allowedOrigins.length === 0) {
  console.warn(
    '[cors] ALLOWED_ORIGINS is not set: requests from any origin are allowed. Set it before deploying.'
  )
}

/**
 * Another origin gets no CORS headers, so the browser blocks the cross-origin read. Refusing the
 * request itself is the job of origin checks.
 */
export async function registerCors(app: FastifyInstance): Promise<void> {
  await app.register(
    cors,
    allowedOrigins.length === 0
      ? {}
      : {
          origin: (origin, callback) => {
            callback(null, origin === undefined || allowedOrigins.includes(origin))
          },
          credentials: true
        }
  )
}
