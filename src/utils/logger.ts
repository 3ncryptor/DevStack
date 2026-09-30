import colors from 'picocolors'

export interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
  success: (message: string) => void
  debug: (message: string) => void
}

export interface LoggerOptions {
  verbose?: boolean
  /** Print nothing (used when stdout must carry only machine output, e.g. --print-plan json). */
  silent?: boolean
}

export class ConsoleLogger implements Logger {
  private readonly verbose: boolean
  private readonly silent: boolean

  constructor(options: LoggerOptions = {}) {
    this.verbose = options.verbose ?? false
    this.silent = options.silent ?? false
  }

  info(message: string): void {
    if (this.silent) return
    console.log(colors.cyan(message))
  }

  warn(message: string): void {
    if (this.silent) return
    console.log(colors.yellow(message))
  }

  error(message: string): void {
    if (this.silent) return
    console.error(colors.red(message))
  }

  success(message: string): void {
    if (this.silent) return
    console.log(colors.green(message))
  }

  debug(message: string): void {
    if (this.silent || !this.verbose) {
      return
    }

    console.log(colors.gray(message))
  }
}
