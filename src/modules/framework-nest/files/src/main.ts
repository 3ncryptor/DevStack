import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

function loadOptionalMiddleware(
  modulePath: string,
  exportName: string
): ((...args: unknown[]) => unknown) | null {
  try {
    const moduleValue = require(modulePath) as Record<string, unknown>
    const middleware = moduleValue[exportName]

    if (typeof middleware !== 'function') {
      return null
    }

    return middleware as (...args: unknown[]) => unknown
  } catch {
    return null
  }
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule)

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

  const port = Number(process.env.PORT ?? 3000)
  await app.listen(port)
  console.log(`Server running on http://localhost:${port}`)
}

void bootstrap()
