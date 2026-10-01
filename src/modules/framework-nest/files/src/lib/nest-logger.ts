import type { LoggerService } from '@nestjs/common'

import type { Logger } from './logger.js'

type Level = 'error' | 'warn' | 'info' | 'debug' | 'trace'

const looksLikeStack = (value: unknown): value is string =>
  typeof value === 'string' && /\n\s+at /.test(value)

function textOf(message: unknown): string {
  if (typeof message === 'string') return message
  if (message instanceof Error) return message.message
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

/** Sends Nest's own logs through pino, so the app writes one JSON log stream. */
export class NestLogger implements LoggerService {
  constructor(private readonly logger: Logger) {}

  log(message: unknown, ...params: unknown[]): void {
    this.write('info', message, params)
  }

  error(message: unknown, ...params: unknown[]): void {
    this.write('error', message, params)
  }

  warn(message: unknown, ...params: unknown[]): void {
    this.write('warn', message, params)
  }

  debug(message: unknown, ...params: unknown[]): void {
    this.write('debug', message, params)
  }

  verbose(message: unknown, ...params: unknown[]): void {
    this.write('trace', message, params)
  }

  /** Nest passes `(message, context)`, or `(message, stack, context)` for errors. */
  private write(level: Level, message: unknown, params: readonly unknown[]): void {
    const stack =
      params.find(looksLikeStack) ?? (message instanceof Error ? message.stack : undefined)
    const last = params.at(-1)
    const context = typeof last === 'string' && !looksLikeStack(last) ? last : undefined
    this.logger[level]({ context, ...(stack === undefined ? {} : { stack }) }, textOf(message))
  }
}
