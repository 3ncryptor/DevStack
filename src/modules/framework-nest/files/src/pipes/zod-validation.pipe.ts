import type { PipeTransform } from '@nestjs/common'
import type { z } from 'zod'

import { ValidationError } from '../lib/errors.js'

/** Validates a body, query or param with Zod: `@Body(new ZodValidationPipe(schema))`. */
export class ZodValidationPipe<T extends z.ZodType> implements PipeTransform<unknown, z.infer<T>> {
  constructor(private readonly schema: T) {}

  transform(value: unknown): z.infer<T> {
    const result = this.schema.safeParse(value)
    if (!result.success) {
      throw new ValidationError(
        'Request is invalid',
        result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }))
      )
    }
    return result.data
  }
}
