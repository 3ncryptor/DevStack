import path from 'node:path'

import { z } from 'zod'

import { generateProject } from './core/generator'
import { loadModules } from './core/module-loader'
import { getPreset } from './core/presets'
import { InputError } from './errors'
import { ClackPrompter } from './intake/clack-prompter'
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
const PROJECT_NAME_PATTERN = /^(?:@[a-zA-Z0-9._-]+\/)?[a-zA-Z0-9._-]+$/

function projectNameProblem(projectName: string): string | undefined {
  return PROJECT_NAME_PATTERN.test(projectName)
    ? undefined
    : 'Invalid project name. Use letters, numbers, dots, underscores, dashes, and optional @ scope only.'
}

function validateProjectName(projectName: string): string {
  const problem = projectNameProblem(projectName)
  if (problem !== undefined) {
    throw new InputError(problem)
  }
  return projectName
}

async function askProjectName(
  prompter: Prompter,
  message: string,
  initialValue: string
): Promise<string> {
  const answer = await prompter.text({ message, initialValue, validate: projectNameProblem })
  return validateProjectName(answer)
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
        ? validateProjectName(projectName)
        : options.yes
          ? defaultName
          : await askProjectName(prompter, 'Package name for current directory', defaultName)
    return { projectName: name, projectDir: process.cwd() }
  }

  const name = projectName
    ? validateProjectName(projectName)
    : options.yes
      ? DEFAULT_PROJECT_NAME
      : await askProjectName(prompter, 'Project name', DEFAULT_PROJECT_NAME)
  return { projectName: name, projectDir: path.resolve(process.cwd(), name) }
}

async function selectModules(
  registry: Map<string, DevstackModule>,
  options: CliOptions,
  prompter: Prompter
): Promise<string[]> {
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

function parseOptions(raw: Partial<CliOptions>): CliOptions {
  const parsed = cliOptionSchema.safeParse(raw)
  if (!parsed.success) {
    throw new InputError(`Invalid options:\n${z.prettifyError(parsed.error)}`)
  }
  return parsed.data
}

export async function runCreateDevstack(input: CreateDevstackInput): Promise<void> {
  const options = parseOptions(input.options)
  const logger = new ConsoleLogger(options.verbose)
  const prompter = input.prompter ?? new ClackPrompter()

  const target = await resolveProjectTarget(input.projectName, options, prompter)

  logger.info('Loading modules...')
  const registry = loadModules()

  const selectedModules = await selectModules(registry, options, prompter)
  if (selectedModules.length === 0) {
    throw new InputError('No modules selected. Aborting.')
  }

  const packageManager = await detectPackageManager(process.cwd())
  logger.info(`Detected package manager: ${packageManager}`)

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
