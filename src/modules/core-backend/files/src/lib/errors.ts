/** An error meant for the client. Anything else becomes a generic 500 (B17.2). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ValidationError extends ApiError {
  constructor(message = 'Request is invalid', details?: unknown) {
    super(400, 'VALIDATION_ERROR', message, details)
  }
}

export class UnauthorizedError extends ApiError {
  constructor(message = 'Authentication required') {
    super(401, 'UNAUTHORIZED', message)
  }
}

export class ForbiddenError extends ApiError {
  constructor(message = 'Not allowed') {
    super(403, 'FORBIDDEN', message)
  }
}

export class NotFoundError extends ApiError {
  constructor(message = 'Not found') {
    super(404, 'NOT_FOUND', message)
  }
}

/** Every error response has this shape (D-61); stack traces never leave the process. */
export interface ErrorBody {
  success: false
  error: { code: string; message: string; requestId: string; details?: unknown }
}

export interface ErrorResponse {
  status: number
  body: ErrorBody
}

/**
 * Client errors raised by libraries carry a 4xx `status`: malformed JSON (with `expose: true`),
 * an undecodable URL (no `expose`). One marked `expose: false` keeps its message private.
 */
function isClientError(error: unknown): error is { status: number; message: string } {
  if (!(error instanceof Error)) return false
  const { status, expose } = error as { status?: unknown; expose?: unknown }
  return expose !== false && typeof status === 'number' && status >= 400 && status < 500
}

export function toErrorResponse(error: unknown, requestId: string): ErrorResponse {
  if (error instanceof ApiError) {
    const details = error.details === undefined ? {} : { details: error.details }
    return {
      status: error.status,
      body: {
        success: false,
        error: { code: error.code, message: error.message, requestId, ...details }
      }
    }
  }
  if (isClientError(error)) {
    return {
      status: error.status,
      body: { success: false, error: { code: 'BAD_REQUEST', message: error.message, requestId } }
    }
  }
  return {
    status: 500,
    body: {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Something went wrong', requestId }
    }
  }
}
