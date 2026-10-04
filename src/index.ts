import path from 'node:path'

import { z } from 'zod'

import { generateProject } from './core/generator'
import { loadModules } from './core/module-loader'
import { findPreset, type ResolvedPreset } from './core/presets'
import { mergeSettings, type ProjectSettings } from './core/settings'
import {
  devstackHome,
  listUserPresets,
  readUserConfig,
  USER_CONFIG_VERSION,
  writeUserConfig,
  writeUserPreset,
  type UserConfig
} from './core/user-home'
import { DefaultsPrompter } from './intake/defaults-prompter'
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
  /** A user preset picked in the wizard's question 0 (task 5.5). */
  preset?: ResolvedPreset
  /** Settings the wizard's answers set, e.g. the module system. */
  settings?: ProjectSettings
}

async function presetFor(options: CliOptions, home: string): Promise<ResolvedPreset | undefined> {
  if (options.preset === undefined) return undefined
  const preset = await findPreset(options.preset, home)
  if (preset === undefined) {
    throw new InputError(
      `Unknown preset: ${options.preset}. See the built-in and your own with: presets list`
    )
  }
  return preset
}

/** Remembered answers (task 5.4), when there are any. */
const rememberedAnswers = (remembered: UserConfig): Record<string, unknown> | undefined =>
  remembered.answers === undefined || Object.keys(remembered.answers).length === 0
    ? undefined
    : remembered.answers

/**
 * Questions are asked unless --yes, a config file or --print-plan json says not to. --yes uses
 * the preset, else the remembered answers (the wizard answering itself), else the backend preset.
 */
async function selectStack(
  options: CliOptions,
  prompter: Prompter,
  sources: { config?: StackConfig; preset?: ResolvedPreset; userPresets: ResolvedPreset[] },
  context: WizardContext,
  services: WizardServices
): Promise<StackChoice> {
  if (sources.config !== undefined) {
    return { modules: splitModuleEntries(sources.config.modules).ids }
  }
  const fromPreset = sources.preset?.modules
  const interactive = !options.yes && options.printPlan !== 'json'
  if (!interactive) {
    if (fromPreset !== undefined) return { modules: [...fromPreset] }
    if (context.remembered !== undefined) {
      return runWizard(new DefaultsPrompter(), context, services)
    }
    const backend = await findPreset('backend', devstackHome())
    return { modules: [...(backend?.modules ?? [])] }
  }
  const wizardContext = {
    ...context,
    presetModules: fromPreset,
    userPresets: sources.userPresets
  }
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

/** Remembered answers are plain values; the package manager is remembered on its own. */
function storableAnswers(
  answers: Readonly<Record<string, unknown>>
): NonNullable<UserConfig['answers']> {
  return Object.fromEntries(
    Object.entries(answers).filter(
      (entry): entry is [string, string | boolean | string[]] =>
        entry[0] !== 'packageManager' &&
        (typeof entry[1] === 'string' ||
          typeof entry[1] === 'boolean' ||
          (Array.isArray(entry[1]) && entry[1].every((item) => typeof item === 'string')))
    )
  )
}

function wizardServices(
  registry: Map<string, DevstackModule>,
  projectDir: string,
  options: CliOptions,
  installed: ReadonlySet<PackageManagerId> | undefined,
  saving: { home: string; settings: ProjectSettings }
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
    savePreset: (name, draft) =>
      writeUserPreset(
        name,
        {
          version: USER_CONFIG_VERSION,
          packageManager: draft.packageManager,
          depth: draft.depth,
          modules: draft.modules.map((id) => {
            const moduleOptions = draft.moduleOptions?.[id]
            return moduleOptions === undefined ? id : { id, options: moduleOptions }
          }),
          ...(Object.keys(saving.settings).length === 0 ? {} : { settings: saving.settings })
        },
        { replace: false },
        saving.home
      ),
    rememberDefaults: async (answers, draft) => {
      const current = await readUserConfig(saving.home)
      return writeUserConfig(
        {
          ...current,
          packageManager: draft.packageManager,
          depth: draft.depth,
          answers: storableAnswers(answers)
        },
        saving.home
      )
    }
  }
}

interface GitAnswers {
  initialCommit: boolean
  /** An existing, empty GitHub repository the commit is pushed to (A0.5). */
  github?: string
}

/**
 * A0.2 #19: whether to make the initial commit, then whether to push it to GitHub; declining the
 * commit skips the push question. --github answers both upfront; settings that turn the commit
 * off ask neither.
 */
async function gitAnswers(
  options: CliOptions,
  prompter: Prompter,
  config: StackConfig | undefined,
  initialCommit: boolean
): Promise<GitAnswers> {
  if (options.github !== undefined) {
    const problem = githubUrlProblem(options.github)
    if (problem !== undefined) throw new InputError(`--github: ${problem}`)
    return { initialCommit, github: options.github }
  }
  const interactive = !options.yes && options.printPlan === undefined && !options.dryRun
  if (!interactive || options.skipGit || config !== undefined || !initialCommit) {
    return { initialCommit }
  }
  const commit = await prompter.confirm({
    message: 'Create an initial git commit? (git is set up either way)',
    initialValue: true
  })
  if (!commit) return { initialCommit: false }
  const connect = await prompter.confirm({
    message: 'Also push it to a GitHub repository? (an existing, empty one; after the checks pass)',
    initialValue: false
  })
  if (!connect) return { initialCommit: true }
  const github = await prompter.text({
    message: 'GitHub repository URL',
    placeholder: 'https://github.com/<owner>/<repo>',
    validate: (value) => githubUrlProblem(value.trim())
  })
  return { initialCommit: true, github }
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
  // precedence (A6 layer 5): flags > config file > preset > remembered defaults > built-in
  const home = devstackHome()
  const remembered = await readUserConfig(home)
  const preset = await presetFor(options, home)
  const userPresets = (
    await Promise.all((await listUserPresets(home)).map((name) => findPreset(name, home)))
  ).filter((found): found is ResolvedPreset => found !== undefined && found.source === 'user')
  const depth = options.depth ?? config?.depth ?? preset?.depth ?? remembered.depth ?? 'wired'
  const detected = choosePackageManager({
    flag: options.pm,
    config: config?.packageManager ?? preset?.packageManager,
    remembered: remembered.packageManager,
    userAgent: process.env.npm_config_user_agent ?? '',
    lockfiles: await lockfilesIn(process.cwd())
  })

  const fixedPackageManager = options.pm ?? config?.packageManager ?? preset?.packageManager
  if (environment !== undefined && fixedPackageManager !== undefined) {
    // fail before the questions, not after them
    await checkAnswers(
      probe,
      environment,
      { packageManager: fixedPackageManager, skipInstall: options.skipInstall, usesDocker: false },
      logger
    )
  }

  const flagSettings: ProjectSettings =
    options.moduleSystem === undefined ? {} : { moduleSystem: options.moduleSystem }
  const settingsBeforeWizard = mergeSettings(
    remembered.settings,
    preset?.settings,
    config?.settings,
    flagSettings
  )
  const rememberedAnswerSet = rememberedAnswers(remembered)
  const choice = await selectStack(
    options,
    prompter,
    {
      ...(config === undefined ? {} : { config }),
      ...(preset === undefined ? {} : { preset }),
      userPresets
    },
    {
      registry,
      projectName: target.projectName,
      depth,
      defaultPackageManager: detected.id,
      fixedPackageManager,
      installedPackageManagers: environment?.installedPackageManagers,
      ...(settingsBeforeWizard.moduleSystem === undefined
        ? {}
        : { defaultModuleSystem: settingsBeforeWizard.moduleSystem }),
      ...(options.moduleSystem === undefined ? {} : { fixedModuleSystem: options.moduleSystem }),
      ...(rememberedAnswerSet === undefined ? {} : { remembered: rememberedAnswerSet })
    },
    wizardServices(registry, target.projectDir, options, environment?.installedPackageManagers, {
      home,
      settings: settingsBeforeWizard
    })
  )
  // a user preset picked in the wizard brings its settings and module options too
  const chosenPreset = preset ?? choice.preset
  // precedence: flags > wizard answers > config > preset > remembered
  const settings = mergeSettings(
    remembered.settings,
    chosenPreset?.settings,
    config?.settings,
    choice.settings,
    flagSettings
  )
  if (options.github !== undefined && settings.initialCommit === false) {
    throw new InputError('--github needs the initial commit; the settings turn it off.')
  }
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

  const git = await gitAnswers(options, prompter, config, settings.initialCommit ?? true)
  await generateProject({
    projectName: target.projectName,
    projectDir: target.projectDir,
    selectedModuleNames: choice.modules,
    moduleOptions:
      config === undefined
        ? { ...chosenPreset?.moduleOptions, ...choice.moduleOptions }
        : splitModuleEntries(config.modules).options,
    depth,
    registry,
    packageManager,
    packageManagerVersion: environment?.packageManagerVersions[packageManager],
    settings: { ...settings, initialCommit: git.initialCommit },
    options: { ...options, github: git.github },
    logger,
    prompter
  })
}
