import type { RequestHandler } from 'express'

import { NotFoundError } from '../lib/errors.js'

export const notFound: RequestHandler = (request, _response, next) => {
  next(new NotFoundError(`Route ${request.method} ${request.path} not found`))
}
