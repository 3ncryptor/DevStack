import {
  SetMetadata,
  type CallHandler,
  type CustomDecorator,
  type ExecutionContext,
  type NestInterceptor
} from '@nestjs/common'
import type { Reflector } from '@nestjs/core'
import { map, type Observable } from 'rxjs'

import { ApiSuccess } from '../lib/api-response.js'

const RAW_RESPONSE = 'devstack:raw-response'

/** Opts a controller or route out of the success envelope, e.g. health probes. */
export const RawResponse = (): CustomDecorator<string> => SetMetadata(RAW_RESPONSE, true)

/**
 * Wraps whatever a handler returns as `{ success: true, data }` (D-61). Return an `ApiSuccess`
 * yourself to add `meta`, e.g. `ApiSuccess.paginated(items, { total, page, limit })`.
 */
export class EnvelopeInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler<unknown>): Observable<unknown> {
    const raw = this.reflector.getAllAndOverride<boolean | undefined>(RAW_RESPONSE, [
      context.getHandler(),
      context.getClass()
    ])
    if (raw === true) return next.handle()
    return next
      .handle()
      .pipe(map((value) => (value instanceof ApiSuccess ? value : new ApiSuccess(value))))
  }
}
