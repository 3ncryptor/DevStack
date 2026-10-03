import type { Logger } from '../lib/logger.js'

// Set by the request-id middleware on every request.
declare global {
  namespace Express {
    interface Request {
      id: string
      log: Logger
    }
  }
}

export {}
