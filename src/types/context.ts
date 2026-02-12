import type { Logger } from '../utils/logger'
import type { PackageManager } from '../utils/package-manager'

export interface GeneratorOptions {
  preset?: string
  yes: boolean
  advanced: boolean
  inPlace: boolean
  skipInstall: boolean
  skipGit: boolean
}

export interface GeneratorContext {
  projectName: string
  projectDir: string
  packageManager: PackageManager
  logger: Logger
  options: GeneratorOptions
  runCommand: (command: string, args: string[]) => Promise<void>
  runPackageManagerCommand: (args: string[]) => Promise<void>
  runPackageManagerExec: (binary: string, args?: string[]) => Promise<void>
}
