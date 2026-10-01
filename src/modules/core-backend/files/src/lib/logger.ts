import { pino, type Logger } from 'pino'

export type { Logger } from 'pino'

/** JSON logs on stdout; credentials in request headers are never written. */
export function createLogger(level: string): Logger {
  return pino({
    level,
    redact: ['req.headers.authorization', 'req.headers.cookie']
  })
}
