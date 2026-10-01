import type { RequestHandler } from 'express'
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
 * Validates parts of a request with Zod: `router.post('/', validate({ body: schema }), handler)`.
 * Every problem is reported at once; parsed values (coercions, defaults) replace the raw ones.
 */
export function validate(schemas: RequestSchemas): RequestHandler {
  return (request, _response, next) => {
    const issues: Issue[] = []
    for (const location of ['body', 'query', 'params'] as const) {
      const result = schemas[location]?.safeParse(request[location])
      if (result === undefined) continue
      if (!result.success) {
        issues.push(
          ...result.error.issues.map((issue) => ({
            location,
            path: issue.path.join('.'),
            message: issue.message
          }))
        )
      } else {
        // Express 5 exposes query through a getter, so the parsed value is defined on the request
        Object.defineProperty(request, location, {
          value: result.data,
          writable: true,
          enumerable: true,
          configurable: true
        })
      }
    }
    next(issues.length > 0 ? new ValidationError('Request is invalid', issues) : undefined)
  }
}
