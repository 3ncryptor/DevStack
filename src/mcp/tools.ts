import { readdir } from 'node:fs/promises'
import path from 'node:path'

import type { PackageManagerId } from '../adapters/package-manager/index'
import { addModules, removeModules, type EvolveResult } from '../commands/evolve'
import { runPlanCommands } from '../core/apply/commands'
import { applyPlan } from '../core/apply/index'
import { pathOf } from '../core/evolve/reconcile'
import { splitModuleEntries } from '../core/manifest'
import { loadModules } from '../core/module-loader'
import { buildGenerationPlan } from '../core/planner/index'
import { findPreset, PRESETS, type ResolvedPreset } from '../core/presets'
import { assertValidProjectName } from '../core/project-name'
import { resolveStack } from '../core/resolver/index'
import { mergeSettings, type ProjectSettings } from '../core/settings'
import { devstackHome, listUserPresets, readUserConfig } from '../core/user-home'
import { InputError } from '../errors'
import { DefaultsPrompter } from '../intake/defaults-prompter'
import type { DevstackModule } from '../types/module'
import type { GenerationPlan } from '../types/plan'
import type { Logger } from '../utils/logger'

/**
 * The MCP tools (task 5.7, D-84) as plain functions: what an AI assistant can ask DevStack to do,
 * with structured results. The server wraps them; tests call them directly.
 */

export type ModuleEntry = string | { id: string; options: Record<string, unknown> }

export interface StackInput {
  name: string
  modules?: ModuleEntry[]
  preset?: string
  packageManager?: PackageManagerId
  depth?: 'bare' | 'wired'
  settings?: ProjectSettings
}

const toStderr = (message: string): void => {
  process.stderr.write(`${message}\n`)
}

/** Progress goes to stderr: stdout carries the protocol. */
export const stderrLogger: Logger = {
  info: toStderr,
  warn: toStderr,
  error: toStderr,
  success: toStderr,
  debug: () => undefined
}

const describeModule = (module: DevstackModule) => ({
  id: module.id,
  title: module.title,
  description: module.description,
  category: module.category,
  ...(module.provides === undefined ? {} : { provides: [...module.provides] }),
  ...(module.requires === undefined ? {} : { requires: [...module.requires] }),
  ...(module.requiresAny === undefined ? {} : { requiresOneOf: [...module.requiresAny] }),
  ...(module.conflictsWith === undefined ? {} : { conflictsWith: [...module.conflictsWith] })
})

export function listModulesTool(input: { category?: string }) {
  const modules = [...loadModules().values()]
    .filter((module) => input.category === undefined || module.category === input.category)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(describeModule)
  return { modules }
}

const describePreset = (preset: ResolvedPreset) => ({
  name: preset.name,
  description: preset.description,
  source: preset.source,
  modules: preset.modules
})

export async function listPresetsTool(home = devstackHome()) {
  const names = [...Object.keys(PRESETS), ...(await listUserPresets(home))]
  const presets = await Promise.all(names.map((name) => findPreset(name, home)))
  return {
    presets: presets
      .filter((preset): preset is ResolvedPreset => preset !== undefined)
      .map(describePreset)
  }
}

/** Whether a module list forms a valid stack, with every problem and its fixes (B5). */
export function validateTool(input: { modules: string[] }) {
  const result = resolveStack(input.modules, loadModules())
  const diagnostics = result.diagnostics.map((diagnostic) => ({
    severity: diagnostic.severity,
    code: diagnostic.code,
    message: diagnostic.message,
    ...(diagnostic.fix === undefined ? {} : { fix: diagnostic.fix }),
    ...(diagnostic.actions === undefined ? {} : { actions: diagnostic.actions })
  }))
  return {
    valid: !diagnostics.some((diagnostic) => diagnostic.severity === 'error'),
    modules: result.modules.map((module) => module.id),
    diagnostics
  }
}

async function presetFor(input: StackInput, home: string): Promise<ResolvedPreset | undefined> {
  if (input.preset === undefined) return undefined
  const preset = await findPreset(input.preset, home)
  if (preset === undefined) {
    throw new InputError(`Unknown preset: ${input.preset}. list_presets shows them.`)
  }
  return preset
}

/** The stack the input describes, with the CLI's precedence: input > preset > remembered. */
async function planFor(
  input: StackInput,
  projectDir: string,
  home: string,
  skipInstall: boolean
): Promise<GenerationPlan> {
  const name = assertValidProjectName(input.name)
  const remembered = await readUserConfig(home)
  const preset = await presetFor(input, home)
  const entries = splitModuleEntries(input.modules ?? [])
  const modules = input.modules === undefined ? (preset?.modules ?? []) : entries.ids
  if (modules.length === 0) throw new InputError('Give modules or a preset.')
  const depth = input.depth ?? preset?.depth ?? remembered.depth
  return buildGenerationPlan({
    projectName: name,
    projectDir,
    selectedModuleNames: modules,
    moduleOptions: { ...preset?.moduleOptions, ...entries.options },
    registry: loadModules(),
    packageManager:
      input.packageManager ?? preset?.packageManager ?? remembered.packageManager ?? 'npm',
    ...(depth === undefined ? {} : { depth }),
    settings: mergeSettings(remembered.settings, preset?.settings, input.settings),
    options: { skipInstall, skipGit: false }
  })
}

function summary(plan: GenerationPlan) {
  return {
    projectName: plan.projectName,
    projectDir: plan.projectDir,
    packageManager: plan.packageManager,
    depth: plan.depth,
    modules: plan.modules,
    settings: plan.settings,
    files: plan.files.map((file) => file.path),
    env: plan.env.map((variable) => ({
      name: variable.name,
      description: variable.description,
      required: variable.required
    })),
    commands: plan.commands.map((command) => [command.command, ...command.args].join(' '))
  }
}

/** What `init` would write and run, without writing anything. */
export async function planTool(input: StackInput, home = devstackHome()) {
  return summary(await planFor(input, path.join(process.cwd(), input.name), home, false))
}

function absoluteDirectory(directory: string): string {
  if (!path.isAbsolute(directory)) {
    throw new InputError(`directory must be an absolute path, got "${directory}".`)
  }
  return path.normalize(directory)
}

/** A new project only ever goes into a folder that does not exist yet or is empty (D-84). */
async function assertEmpty(directory: string): Promise<void> {
  const entries = await readdir(directory).catch(() => [])
  if (entries.length > 0) {
    throw new InputError(`${directory} is not empty; DevStack never writes over existing files.`)
  }
}

/** Generates the project; installs and runs the modules' steps unless `install` is false. */
export async function initTool(
  input: StackInput & { directory: string; install?: boolean },
  home = devstackHome()
) {
  const directory = absoluteDirectory(input.directory)
  await assertEmpty(directory)
  const install = input.install ?? true
  const plan = await planFor(input, directory, home, !install)
  const result = await applyPlan(plan, {
    yes: true,
    force: false,
    prompter: new DefaultsPrompter(),
    logger: stderrLogger
  })
  await runPlanCommands(plan, stderrLogger, 'stderr')
  return {
    ...summary(plan),
    written: result.written.length,
    installed: install,
    next: [
      `cd ${directory}`,
      ...(install ? [] : [`${plan.packageManager} install`]),
      `${plan.packageManager} run dev`
    ]
  }
}

function evolveSummary(result: EvolveResult) {
  return {
    modules: result.modules,
    changes: result.changes.map((change) => ({ kind: change.kind, path: pathOf(change) })),
    report: result.report,
    ...(result.outcome === undefined
      ? {}
      : {
          sidecars: result.outcome.sidecars,
          ...(result.outcome.backupDir === undefined ? {} : { backupDir: result.outcome.backupDir })
        })
  }
}

export interface EvolveToolInput {
  directory: string
  modules: string[]
  dryRun?: boolean
  force?: boolean
}

const evolveOptions = (input: EvolveToolInput) => ({
  projectDir: absoluteDirectory(input.directory),
  dryRun: input.dryRun ?? false,
  force: input.force ?? false,
  skipInstall: false,
  logger: stderrLogger,
  commandOutput: 'stderr' as const
})

export async function addModulesTool(input: EvolveToolInput) {
  return evolveSummary(await addModules(input.modules, evolveOptions(input)))
}

export async function removeModulesTool(input: EvolveToolInput) {
  return evolveSummary(await removeModules(input.modules, evolveOptions(input)))
}
