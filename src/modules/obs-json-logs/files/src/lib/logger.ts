import { logFields } from './log-fields.js'

/** One call shape for every level: `logger.info({ userId }, 'signed in')` or `logger.info('up')`. */
export type LogFn = (fieldsOrMessage: unknown, message?: string, ...args: unknown[]) => void

/**
 * The logger the app uses (D-76): pino's shape, so Express, Fastify and Nest take it as is,
 * with no dependency underneath: one JSON object per line on stdout.
 */
export interface Logger {
  level: string
  fatal: LogFn
  error: LogFn
  warn: LogFn
  info: LogFn
  debug: LogFn
  trace: LogFn
  silent: LogFn
  child(bindings: Record<string, unknown>): Logger
}

const RANK = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, fatal: 60 }
type Level = keyof typeof RANK

function isLevel(level: string): level is Level {
  return level in RANK
}

function build(level: string, bindings: Record<string, unknown>): Logger {
  const threshold = isLevel(level) ? RANK[level] : Number.POSITIVE_INFINITY
  const at =
    (name: Level): LogFn =>
    (fieldsOrMessage, message) => {
      if (RANK[name] < threshold) return
      const fields =
        typeof fieldsOrMessage === 'string'
          ? {}
          : fieldsOrMessage instanceof Error
            ? { err: fieldsOrMessage }
            : ((fieldsOrMessage ?? {}) as Record<string, unknown>)
      const msg = typeof fieldsOrMessage === 'string' ? fieldsOrMessage : (message ?? '')
      const line = {
        level: name,
        time: new Date().toISOString(),
        msg,
        ...bindings,
        ...logFields(fields)
      }
      process.stdout.write(`${JSON.stringify(line)}\n`)
    }
  return {
    level,
    fatal: at('fatal'),
    error: at('error'),
    warn: at('warn'),
    info: at('info'),
    debug: at('debug'),
    trace: at('trace'),
    silent: () => undefined,
    child: (childBindings) => build(level, { ...bindings, ...logFields(childBindings) })
  }
}

/** JSON lines on stdout, no dependency; credentials in request headers are never written. */
export function createLogger(level: string): Logger {
  return build(level, {})
}
