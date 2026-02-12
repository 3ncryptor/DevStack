import express from 'express'
import type { RequestHandler } from 'express'

import { healthRouter } from './routes/health'

export const app = express()

function loadOptionalMiddleware(modulePath: string, exportName: string): RequestHandler | null {
  try {
    const moduleValue = require(modulePath) as Record<string, unknown>
    const middleware = moduleValue[exportName]

    if (typeof middleware !== 'function') {
      return null
    }

    return middleware as RequestHandler
  } catch {
    return null
  }
}

app.use(express.json())

const optionalMiddlewares: Array<{ modulePath: string; exportName: string }> = [
  { modulePath: './middlewares/request-logger', exportName: 'requestLoggerMiddleware' },
  { modulePath: './middlewares/helmet', exportName: 'helmetMiddleware' },
  { modulePath: './middlewares/cors', exportName: 'corsMiddleware' },
  { modulePath: './middlewares/origin-check', exportName: 'originCheckMiddleware' },
  { modulePath: './middlewares/rate-limit', exportName: 'apiRateLimiter' },
  { modulePath: './middlewares/compression', exportName: 'compressionMiddleware' }
]

for (const optionalMiddleware of optionalMiddlewares) {
  const middleware = loadOptionalMiddleware(
    optionalMiddleware.modulePath,
    optionalMiddleware.exportName
  )

  if (middleware) {
    app.use(middleware)
  }
}

app.use('/health', healthRouter)
