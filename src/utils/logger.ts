import chalk from 'chalk'

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
    console.log(chalk.cyan(message))
  }

  warn(message: string): void {
    console.log(chalk.yellow(message))
  }

  error(message: string): void {
    console.error(chalk.red(message))
  }

  success(message: string): void {
    console.log(chalk.green(message))
  }

  debug(message: string): void {
    if (!this.verbose) {
      return
    }

    console.log(chalk.gray(message))
  }
}
