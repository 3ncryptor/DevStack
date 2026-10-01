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
import { DevstackError, InputError, ResolutionError } from './errors'
import { ClackPrompter } from './intake/clack-prompter'
import { loadStackConfig } from './intake/config'
import type { Prompter } from './intake/prompter'
import { githubUrlProblem } from './core/finish/github'
import { checkAnswers, runPreflight } from './intake/preflight'
import { saveStackPreset } from './intake/save-preset'
import {
  runAdvancedWizard,
  runWizard,
  type StackDraft,
  type StackPreview,
  type WizardContext,
  type WizardServices
} from './prompts/wizard/index'
import { cliOptionSchema, type CliOptions } from './types/cli'
import type { DevstackModule } from './types/module'
import { ConsoleLogger } from './utils/logger'
import {
  choosePackageManager,
  lockfilesIn,
  type PackageManagerId
} from './adapters/package-manager/index'
import { systemProbe, type EnvironmentReport, type Probe } from './core/doctor'
import { splitModuleEntries, type StackConfig } from './core/manifest'
import { buildGenerationPlan } from './core/planner/index'
import { resolveStack } from './core/resolver/index'

export interface CreateDevstackInput {
  projectName?: string
  options: Partial<CliOptions>
  /** Injected in tests; defaults to the interactive clack prompter. */
  prompter?: Prompter
  /** Injected in tests; defaults to running the real commands for the pre-flight. */
  probe?: Probe
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

interface StackChoice {
  modules: string[]
  /** Options set by the wizard's answers; a config file carries its own. */
  moduleOptions?: Record<string, Record<string, unknown>>
  /** Set when the wizard asked; otherwise the detected package manager is used. */
  packageManager?: PackageManagerId
}

function presetModules(options: CliOptions): string[] | undefined {
  if (options.preset === undefined) return undefined
  const preset = getPreset(options.preset)
  if (!preset) {
    throw new InputError(`Unknown preset: ${options.preset}`)
  }
  return [...preset.modules]
}

/** Questions are asked unless --yes, a config file or --print-plan json says not to. */
async function selectStack(
  options: CliOptions,
  prompter: Prompter,
  config: StackConfig | undefined,
  context: WizardContext,
  services: WizardServices
): Promise<StackChoice> {
  if (config !== undefined) {
    return { modules: splitModuleEntries(config.modules).ids }
  }
  const fromPreset = presetModules(options)
  const interactive = !options.yes && options.printPlan !== 'json'
  if (!interactive) {
    return { modules: fromPreset ?? [...(getPreset('backend')?.modules ?? [])] }
  }
  const wizardContext = { ...context, presetModules: fromPreset }
  if (options.advanced) {
    return { modules: (await runAdvancedWizard(prompter, wizardContext, services)).modules }
  }
  return runWizard(prompter, wizardContext, services)
}

function missingPackageManager(
  draft: StackDraft,
  options: CliOptions,
  installed: ReadonlySet<PackageManagerId> | undefined
): string[] {
  if (installed === undefined || options.skipInstall || installed.has(draft.packageManager)) {
    return []
  }
  return [
    `${draft.packageManager} is not installed. Pick another package manager, install it, or re-run with --skip-install.`
  ]
}

/** Plans in memory for the review screen; a stack that cannot be planned becomes a problem. */
async function previewDraft(
  draft: StackDraft,
  registry: Map<string, DevstackModule>,
  projectDir: string,
  options: CliOptions
): Promise<Pick<StackPreview, 'diagnostics' | 'fileCount' | 'problems'>> {
  const { diagnostics } = resolveStack(draft.modules, registry)
  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    return { diagnostics }
  }
  try {
    const plan = await buildGenerationPlan({
      projectName: draft.projectName,
      projectDir,
      selectedModuleNames: draft.modules,
      moduleOptions: draft.moduleOptions,
      depth: draft.depth,
      registry,
      packageManager: draft.packageManager,
      options: { skipInstall: options.skipInstall, skipGit: options.skipGit }
    })
    return { diagnostics, fileCount: plan.files.length }
  } catch (error: unknown) {
    if (error instanceof ResolutionError) return { diagnostics: [...error.diagnostics] }
    // other DevStack errors are reported on the review screen; anything else is a bug
    if (error instanceof DevstackError) return { diagnostics, problems: [error.message] }
    throw error
  }
}

function wizardServices(
  registry: Map<string, DevstackModule>,
  projectDir: string,
  options: CliOptions,
  installed: ReadonlySet<PackageManagerId> | undefined
): WizardServices {
  return {
    preview: async (draft): Promise<StackPreview> => {
      const preview = await previewDraft(draft, registry, projectDir, options)
      const problems = [
        ...(preview.problems ?? []),
        ...missingPackageManager(draft, options, installed)
      ]
      return { ...preview, problems }
    },
    savePreset: (fileName, draft) => saveStackPreset(process.cwd(), fileName, draft)
  }
}

/** A0.2 #19: an existing, empty GitHub repository to push to; --github answers it upfront. */
async function githubUrl(
  options: CliOptions,
  prompter: Prompter,
  config: StackConfig | undefined
): Promise<string | undefined> {
  if (options.github !== undefined) {
    const problem = githubUrlProblem(options.github)
    if (problem !== undefined) throw new InputError(`--github: ${problem}`)
    return options.github
  }
  const interactive = !options.yes && options.printPlan === undefined && !options.dryRun
  if (!interactive || options.skipGit || config !== undefined) return undefined
  const connect = await prompter.confirm({
    message: 'Connect a GitHub repository? (an existing, empty one; pushed after the checks pass)',
    initialValue: false
  })
  if (!connect) return undefined
  return prompter.text({
    message: 'GitHub repository URL',
    placeholder: 'https://github.com/<owner>/<repo>',
    validate: (value) => githubUrlProblem(value.trim())
  })
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
  const probe = input.probe ?? systemProbe
  // Nothing is installed or committed in a dry run, so the environment does not matter there.
  const environment: EnvironmentReport | undefined =
    options.dryRun || options.printPlan !== undefined
      ? undefined
      : await runPreflight(probe, logger)

  const target = await resolveProjectTarget(projectName, options, prompter)

  logger.info('Loading modules...')
  const registry = loadModules()
  const depth = options.depth ?? config?.depth ?? 'wired'
  const detected = choosePackageManager({
    flag: options.pm,
    config: config?.packageManager,
    userAgent: process.env.npm_config_user_agent ?? '',
    lockfiles: await lockfilesIn(process.cwd())
  })

  const fixedPackageManager = options.pm ?? config?.packageManager
  if (environment !== undefined && fixedPackageManager !== undefined) {
    // fail before the questions, not after them
    await checkAnswers(
      probe,
      environment,
      { packageManager: fixedPackageManager, skipInstall: options.skipInstall, usesDocker: false },
      logger
    )
  }

  const choice = await selectStack(
    options,
    prompter,
    config,
    {
      registry,
      projectName: target.projectName,
      depth,
      defaultPackageManager: detected.id,
      fixedPackageManager,
      installedPackageManagers: environment?.installedPackageManagers
    },
    wizardServices(registry, target.projectDir, options, environment?.installedPackageManagers)
  )
  if (choice.modules.length === 0) {
    throw new InputError('No modules selected. Aborting.')
  }
  const answered = fixedPackageManager === undefined && choice.packageManager !== undefined
  const packageManager = (answered ? choice.packageManager : undefined) ?? detected.id
  logger.info(`Package manager: ${packageManager} (${answered ? 'your answer' : detected.source})`)
  if (environment !== undefined) {
    await checkAnswers(
      probe,
      environment,
      {
        packageManager,
        skipInstall: options.skipInstall,
        usesDocker: choice.modules.includes('devops-docker')
      },
      logger
    )
  }

  await generateProject({
    projectName: target.projectName,
    projectDir: target.projectDir,
    selectedModuleNames: choice.modules,
    moduleOptions:
      config === undefined
        ? (choice.moduleOptions ?? {})
        : splitModuleEntries(config.modules).options,
    depth,
    registry,
    packageManager,
    packageManagerVersion: environment?.packageManagerVersions[packageManager],
    options: { ...options, github: await githubUrl(options, prompter, config) },
    logger,
    prompter
  })
}
