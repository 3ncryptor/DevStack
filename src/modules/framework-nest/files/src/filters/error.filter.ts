import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common'
import type { Request, Response } from 'express'

import { ApiError, toErrorResponse } from '../lib/errors.js'
import type { Logger } from '../lib/logger.js'

const CODES: Readonly<Record<number, string>> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'TOO_MANY_REQUESTS'
}

/** Nest's own 4xx exceptions (unknown route, bad JSON) are client errors like any ApiError. */
function fromNest(exception: unknown): unknown {
  if (!(exception instanceof HttpException) || exception.getStatus() >= 500) return exception
  const status = exception.getStatus()
  return new ApiError(status, CODES[status] ?? 'CLIENT_ERROR', exception.message)
}

/** Every error becomes the error envelope (B17.2); 5xx are logged with the cause. */
@Catch()
export class ErrorFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp()
    const request = http.getRequest<Request>()
    const response = http.getResponse<Response>()
    if (response.headersSent) return
    const mapped = toErrorResponse(fromNest(exception), request.id)
    // a deliberate 5xx (e.g. 503) keeps its status; its message stays private like any 5xx
    const status = exception instanceof HttpException ? exception.getStatus() : mapped.status
    const body = mapped.body
    if (status >= 500) {
      const log = request.log ?? this.logger
      log.error({ err: exception }, 'request failed')
    }
    response.status(status).json(body)
  }
}
