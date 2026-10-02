import type { FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import type { z } from 'zod'

import { ValidationError } from '../lib/errors.js'

export interface RequestSchemas {
  body?: z.ZodType
  query?: z.ZodType
  params?: z.ZodType
}

interface Issue {
  location: keyof RequestSchemas
  path: string
  message: string
}

/**
 * Validates parts of a request with Zod: `app.post('/', { preHandler: validate({ body }) }, h)`.
 * Every problem is reported at once; parsed values (coercions, defaults) replace the raw ones.
 */
export function validate(schemas: RequestSchemas): preHandlerAsyncHookHandler {
  return async (request: FastifyRequest) => {
    const issues: Issue[] = []
    const parts = request as unknown as Record<keyof RequestSchemas, unknown>
    for (const location of ['body', 'query', 'params'] as const) {
      const result = schemas[location]?.safeParse(parts[location])
      if (result === undefined) continue
      if (result.success) {
        parts[location] = result.data
      } else {
        issues.push(
          ...result.error.issues.map((issue) => ({
            location,
            path: issue.path.join('.'),
            message: issue.message
          }))
        )
      }
    }
    if (issues.length > 0) throw new ValidationError('Request is invalid', issues)
    return Promise.resolve()
  }
}
