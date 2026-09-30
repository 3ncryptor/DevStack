import path from 'node:path'

import { z } from 'zod'

import { generateProject } from './core/generator'
import { loadModules } from './core/module-loader'
import { getPreset } from './core/presets'
import {
  assertValidProjectName,
  projectDirectoryName,
  projectNameProblem
} from './core/project-name'
import { InputError } from './errors'
import type { StackConfig } from './core/manifest'
import { ClackPrompter } from './intake/clack-prompter'
import { loadStackConfig } from './intake/config'
import type { Prompter } from './intake/prompter'
import { runAdvancedPrompt } from './prompts/advanced'
import { runBasicPrompt } from './prompts/basic'
import { cliOptionSchema, type CliOptions } from './types/cli'
import type { DevstackModule } from './types/module'
import { ConsoleLogger } from './utils/logger'
import { detectPackageManager } from './utils/package-manager'

export interface CreateDevstackInput {
  projectName?: string
  options: Partial<CliOptions>
  /** Injected in tests; defaults to the interactive clack prompter. */
  prompter?: Prompter
}

interface ProjectTarget {
  projectName: string
  projectDir: string
}

const DEFAULT_PROJECT_NAME = 'devstack-app'

async function askProjectName(
  prompter: Prompter,
  message: string,
  initialValue: string
): Promise<string> {
  const answer = await prompter.text({ message, initialValue, validate: projectNameProblem })
  return assertValidProjectName(answer)
}

async function resolveProjectTarget(
  projectName: string | undefined,
  options: CliOptions,
  prompter: Prompter
): Promise<ProjectTarget> {
  if (options.inPlace || projectName === '.') {
    const directoryName = path.basename(process.cwd())
    const defaultName =
      projectNameProblem(directoryName) === undefined ? directoryName : DEFAULT_PROJECT_NAME
    const name =
      projectName && projectName !== '.'
        ? assertValidProjectName(projectName)
        : options.yes
          ? defaultName
          : await askProjectName(prompter, 'Package name for current directory', defaultName)
    return { projectName: name, projectDir: process.cwd() }
  }

  const name = projectName
    ? assertValidProjectName(projectName)
    : options.yes
      ? DEFAULT_PROJECT_NAME
      : await askProjectName(prompter, 'Project name', DEFAULT_PROJECT_NAME)
  return { projectName: name, projectDir: path.resolve(process.cwd(), projectDirectoryName(name)) }
}

async function selectModules(
  registry: Map<string, DevstackModule>,
  options: CliOptions,
  prompter: Prompter,
  config: StackConfig | undefined
): Promise<string[]> {
  if (config !== undefined) {
    return [...config.modules]
  }
  if (options.advanced) {
    const presetModules = options.preset ? (getPreset(options.preset)?.modules ?? []) : []
    return runAdvancedPrompt(registry, prompter, presetModules)
  }
  if (options.preset) {
    const preset = getPreset(options.preset)
    if (!preset) {
      throw new InputError(`Unknown preset: ${options.preset}`)
    }
    return [...preset.modules]
  }
  if (options.yes) {
    return [...(getPreset('backend')?.modules ?? [])]
  }
  return (await runBasicPrompt(registry, prompter)).selectedModules
}

/** Prompts write to stdout, which would corrupt the JSON document; require every answer upfront. */
function assertNonInteractive(projectName: string | undefined, options: CliOptions): void {
  const needsName = projectName === undefined && !options.yes
  const needsModules =
    options.advanced ||
    (options.preset === undefined && options.config === undefined && !options.yes)
  if (needsName || needsModules) {
    throw new InputError(
      '--print-plan json cannot ask questions. Pass a project name and --preset <name>, or --yes.'
    )
  }
}

async function readConfig(options: CliOptions): Promise<StackConfig | undefined> {
  if (options.config === undefined) {
    return undefined
  }
  if (options.preset !== undefined || options.advanced) {
    throw new InputError(
      '--config cannot be combined with --preset or --advanced: the config already lists the modules.'
    )
  }
  return loadStackConfig(path.resolve(process.cwd(), options.config))
}

function parseOptions(raw: Partial<CliOptions>): CliOptions {
  const parsed = cliOptionSchema.safeParse(raw)
  if (!parsed.success) {
    throw new InputError(`Invalid options:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export async function runCreateDevstack(input: CreateDevstackInput): Promise<void> {
  const options = parseOptions(input.options)
  // With --print-plan json, stdout must carry only the JSON document.
  const logger = new ConsoleLogger({
    verbose: options.verbose,
    silent: options.printPlan === 'json'
  })
  const prompter = input.prompter ?? new ClackPrompter()

  const config = await readConfig(options)
  // a name on the command line wins over the config's (flags > config file)
  const projectName = input.projectName ?? config?.name
  if (options.printPlan === 'json') {
    assertNonInteractive(projectName, options)
  }
  const target = await resolveProjectTarget(projectName, options, prompter)

  logger.info('Loading modules...')
  const registry = loadModules()

  const selectedModules = await selectModules(registry, options, prompter, config)
  if (selectedModules.length === 0) {
    throw new InputError('No modules selected. Aborting.')
  }

  const packageManager = config?.packageManager ?? (await detectPackageManager(process.cwd()))
  logger.info(`Package manager: ${packageManager}${config?.packageManager ? ' (from config)' : ''}`)

  await generateProject({
    projectName: target.projectName,
    projectDir: target.projectDir,
    selectedModuleNames: selectedModules,
    registry,
    packageManager,
    options,
    logger,
    prompter
  })
}
