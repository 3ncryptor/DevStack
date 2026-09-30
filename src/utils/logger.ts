import colors from 'picocolors'

export interface Logger {
  info: (message: string) => void
  warn: (message: string) => void
  error: (message: string) => void
  success: (message: string) => void
  debug: (message: string) => void
}

export class ConsoleLogger implements Logger {
  constructor(private readonly verbose = false) {}

  info(message: string): void {
    console.log(colors.cyan(message))
  }

  warn(message: string): void {
    console.log(colors.yellow(message))
  }

  error(message: string): void {
    console.error(colors.red(message))
  }

  success(message: string): void {
    console.log(colors.green(message))
  }

  debug(message: string): void {
    if (!this.verbose) {
      return
    }

    console.log(colors.gray(message))
  }
}
