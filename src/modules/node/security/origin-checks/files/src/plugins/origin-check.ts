import type { FastifyInstance } from 'fastify'

import { ForbiddenError, toErrorResponse } from '../lib/errors.js'

function parseAllowedOrigins(): string[] {
  const rawOrigins = process.env.ALLOWED_ORIGINS ?? ''
  return rawOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)
}

const allowedOrigins = parseAllowedOrigins()

if (allowedOrigins.length === 0) {
  console.warn('[origin-check] ALLOWED_ORIGINS is not set: origin checks are disabled.')
}

/** Refuses requests whose Origin is not in ALLOWED_ORIGINS with 403 and the error envelope. */
export function registerOriginCheck(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    const origin = request.headers.origin
    if (allowedOrigins.length === 0 || origin === undefined || allowedOrigins.includes(origin)) {
      done()
      return
    }
    const { status, body } = toErrorResponse(new ForbiddenError('Origin not allowed'), request.id)
    void reply.status(status).send(body)
  })
}
