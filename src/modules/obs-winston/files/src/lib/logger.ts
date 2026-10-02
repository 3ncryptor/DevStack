import winston from 'winston'

import { logFields } from './log-fields.js'

/** One call shape for every level: `logger.info({ userId }, 'signed in')` or `logger.info('up')`. */
export type LogFn = (fieldsOrMessage: unknown, message?: string, ...args: unknown[]) => void

/**
 * The logger the app uses (D-76): pino's shape, so Express, Fastify and Nest take it as is,
 * with Winston underneath.
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

const LEVELS = { fatal: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 }

function wrap(target: winston.Logger, level: string): Logger {
  const at =
    (name: keyof typeof LEVELS): LogFn =>
    (fieldsOrMessage, message) => {
      if (typeof fieldsOrMessage === 'string') {
        target.log(name, fieldsOrMessage)
        return
      }
      const fields =
        fieldsOrMessage instanceof Error
          ? { err: fieldsOrMessage }
          : ((fieldsOrMessage ?? {}) as Record<string, unknown>)
      target.log(name, message ?? '', logFields(fields))
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
    child: (bindings) => wrap(target.child(logFields(bindings)), level)
  }
}

/** JSON logs on stdout through Winston; credentials in request headers are never written. */
export function createLogger(level: string): Logger {
  const silent = level === 'silent'
  return wrap(
    winston.createLogger({
      levels: LEVELS,
      level: silent ? 'fatal' : level,
      silent,
      format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
      transports: [new winston.transports.Console()]
    }),
    level
  )
}
