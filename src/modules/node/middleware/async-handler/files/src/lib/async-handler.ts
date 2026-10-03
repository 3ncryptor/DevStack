import type { NextFunction, Request, RequestHandler, Response } from 'express'

type AsyncRequestHandler = (
  request: Request,
  response: Response,
  next: NextFunction
) => Promise<unknown>

/**
 * Sends a rejected promise from a route handler to the error handler:
 *
 *   router.get('/items/:id', asyncHandler(async (request, response) => { ... }))
 *
 * Express 5 already does this for async handlers, so this is a style choice: it makes the
 * intent explicit and keeps code portable to Express 4 middleware stacks.
 */
export function asyncHandler(handler: AsyncRequestHandler): RequestHandler {
  return (request, response, next) => {
    handler(request, response, next).catch(next)
  }
}
