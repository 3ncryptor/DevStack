/**
 * Turns log fields into plain JSON the way pino's serializers do: requests and responses become
 * their method, URL and status, errors their type, message and stack, credentials are redacted,
 * and circular references are cut (framework request objects are circular).
 */
const REDACTED_HEADERS = new Set(['authorization', 'cookie'])

interface RequestLike {
  method?: unknown
  url?: unknown
  id?: unknown
  headers?: Record<string, unknown>
}

function serializeRequest(request: RequestLike) {
  const headers = Object.fromEntries(
    Object.entries(request.headers ?? {}).map(([name, value]) => [
      name,
      REDACTED_HEADERS.has(name.toLowerCase()) ? '[Redacted]' : value
    ])
  )
  return { id: request.id, method: request.method, url: request.url, headers }
}

function serializeError(error: unknown) {
  return error instanceof Error
    ? { type: error.name, message: error.message, stack: error.stack }
    : { message: String(error) }
}

function serializeField(key: string, value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value
  if (key === 'err' || value instanceof Error) return serializeError(value)
  if (key === 'req') return serializeRequest(value)
  if (key === 'res') return { statusCode: (value as { statusCode?: unknown }).statusCode }
  return value
}

/** Plain, JSON-safe fields for a log line. */
export function logFields(fields: Record<string, unknown>): Record<string, unknown> {
  const seen = new WeakSet<object>()
  const plain = Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, serializeField(key, value)])
  )
  return JSON.parse(
    JSON.stringify(plain, (_key, value: unknown) => {
      if (typeof value === 'bigint') return value.toString()
      if (value === null || typeof value !== 'object') return value
      if (seen.has(value)) return '[Circular]'
      seen.add(value)
      return value
    })
  ) as Record<string, unknown>
}
