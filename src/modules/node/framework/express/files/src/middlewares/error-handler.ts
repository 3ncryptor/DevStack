import type { ErrorRequestHandler } from 'express'

import { toErrorResponse } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'

/** Last middleware: every error becomes the error envelope; 5xx are logged with the cause. */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, request, response, next) => {
    if (response.headersSent) {
      next(error)
      return
    }
    const { status, body } = toErrorResponse(error, request.id)
    if (status >= 500) {
      // request.log is missing only if the error happened before the request-id middleware
      const log = request.log ?? logger
      log.error({ err: error }, 'request failed')
    }
    response.status(status).json(body)
  }
}
