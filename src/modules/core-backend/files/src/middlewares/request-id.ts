import { randomUUID } from 'node:crypto'

import type { NextFunction, Request, RequestHandler, Response } from 'express'

import type { Logger } from '../lib/logger.js'

const HEADER = 'x-request-id'
/** An upstream id is reused only when it looks like one, so logs cannot be spoofed with junk. */
const VALID_ID = /^[\w.:-]{1,128}$/

/** First middleware: every request gets an id, echoed in the response and in its log lines. */
export function requestId(logger: Logger): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    const incoming = request.get(HEADER)
    const id = incoming !== undefined && VALID_ID.test(incoming) ? incoming : randomUUID()
    request.id = id
    request.log = logger.child({ requestId: id })
    response.setHeader(HEADER, id)
    next()
  }
}
