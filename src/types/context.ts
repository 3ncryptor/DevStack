import type { Prompter } from '../intake/prompter'
import type { Logger } from '../utils/logger'
import type { PackageManager } from '../utils/package-manager'
import type { CliOptions } from './cli'

export type GeneratorOptions = CliOptions

export interface GeneratorContext {
  projectName: string
  projectDir: string
  packageManager: PackageManager
  logger: Logger
  prompter: Prompter
  options: GeneratorOptions
  runCommand: (command: string, args: string[]) => Promise<void>
  runPackageManagerCommand: (args: string[]) => Promise<void>
  runPackageManagerExec: (binary: string, args?: string[]) => Promise<void>
}
