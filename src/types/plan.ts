import type { PackageManagerId as PackageManager } from '../adapters/package-manager/index'

/**
 * How a planned file treats an existing file at the same path:
 * - `create`: an existing file is a conflict (the conflict policy decides; `--yes` never overwrites)
 * - `skip-if-exists`: an existing file is kept as-is, without asking
 * - `json-merge`: missing keys are added to the existing JSON object; existing values win
 * - `line-merge`: missing lines are appended (e.g. .gitignore); existing lines stay
 * A merge only adds, so it needs no confirmation; the original is still backed up. A file that
 * cannot be merged (invalid JSON) falls back to `create`'s conflict policy.
 */
export type WriteStrategy = 'create' | 'skip-if-exists' | 'json-merge' | 'line-merge'

export interface PlannedFile {
  /** Project-relative, forward slashes. */
  path: string
  content: string
  /** Unix permission bits, e.g. 0o644 or 0o755 for git hooks. */
  mode: number
  strategy: WriteStrategy
  /** Module id that produced the file, or `devstack` for files the generator writes itself. */
  source: string
}

export type CommandPhase = 'git' | 'install' | 'hooks' | 'postInstall'

export interface PlannedCommand {
  phase: CommandPhase
  command: string
  args: string[]
  description: string
  /** Skip the command at apply time when this project-relative path already exists. */
  skipIfExists?: string
}

/** An environment variable of the generated project, merged across the modules declaring it. */
export interface PlannedEnvVar {
  name: string
  description: string
  example?: string
  required: boolean
  secret: boolean
  /** Zod expression for the generated `config/env.ts`. */
  schema: string
  /** Modules that declare it, in module order. */
  owners: string[]
  warnings: string[]
}

/** Everything generation will write and run, as data (buildPlan B2). Contains no side effects. */
export interface GenerationPlan {
  projectName: string
  projectDir: string
  packageManager: PackageManager
  /** Resolved module ids in dependency order. */
  modules: string[]
  /** Sorted by path. */
  files: PlannedFile[]
  commands: PlannedCommand[]
  env: PlannedEnvVar[]
  /** `bare` or `wired` (task 1.9). */
  depth: 'bare' | 'wired'
}
