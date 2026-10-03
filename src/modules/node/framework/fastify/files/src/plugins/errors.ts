import type { FastifyError, FastifyInstance } from 'fastify'

import { ApiError, NotFoundError, toErrorResponse } from '../lib/errors.js'

/**
 * Fastify's own client errors (malformed JSON, unsupported media type) carry `statusCode`; they
 * are passed on with `status` so they keep their 4xx and message in the envelope.
 */
function normalize(error: FastifyError): unknown {
  if (error instanceof ApiError) return error
  const status = error.statusCode
  return typeof status === 'number' && status >= 400 && status < 500
    ? Object.assign(new Error(error.message), { status })
    : error
}

/** Every error and unknown route answers the error envelope (D-61); 5xx are logged. */
export function registerErrorHandlers(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const { status, body } = toErrorResponse(normalize(error), request.id)
    if (status >= 500) request.log.error({ err: error }, 'request failed')
    return reply.status(status).send(body)
  })

  app.setNotFoundHandler((request, reply) => {
    const path = request.url.split('?')[0] ?? request.url
    const { status, body } = toErrorResponse(
      new NotFoundError(`Route ${request.method} ${path} not found`),
      request.id
    )
    return reply.status(status).send(body)
  })
}
