import { PACKAGE_MANAGERS, type PackageManagerId } from '../../adapters/package-manager/index'
import type { Choice, Prompter } from '../../intake/prompter'
import type { ModuleSystem, WizardQuestion } from '../../types/module'
import { fitsStack, moduleChoices, type Registry } from './choices'
import { previewNote } from './folder-previews'

/**
 * The wizard's questions as data, in the A0.2 order (D-34). A question about modules offers the
 * ones that declare it (D-96) and fit the answers before it. Each step says when it applies,
 * which modules its answer adds and how the review screen shows it, so "Edit an answer" can
 * re-ask one step and the rest follows.
 */

export interface WizardAnswers {
  appType?: string
  framework?: string
  moduleSystem?: ModuleSystem
  frontend?: string
  styling?: string
  admin?: boolean
  frontendArchitecture?: string
  database?: string
  orm?: string
  redis?: boolean
  auth?: string
  oauthProviders?: string[]
  template?: string
  logger?: string
  packageManager?: PackageManagerId
  architecture?: string
  preCommit?: boolean
  docker?: boolean
  appSetup?: string[]
  repoExtras?: string[]
  rateLimitAlgorithm?: string
  tests?: string
  apiVersioning?: boolean
  apiDocs?: boolean
  ci?: boolean
  asyncHandler?: boolean
}

export interface StepEnvironment {
  registry: Registry
  defaultPackageManager: PackageManagerId
  /** Set by --pm or a config; the package manager question is then skipped. */
  fixedPackageManager?: PackageManagerId
  /** From the pre-flight; managers missing here are marked "not installed". */
  installedPackageManagers?: ReadonlySet<PackageManagerId>
  /** From the settings (config, preset, remembered); pre-selects the module system. */
  defaultModuleSystem?: ModuleSystem
  /** Set by --module-system; the question is then skipped. */
  fixedModuleSystem?: ModuleSystem
  /**
   * Remembered answers (task 5.4): pre-selected, never taken as answered, so every question is
   * still asked. A remembered value that no longer fits is ignored.
   */
  remembered?: Readonly<Record<string, unknown>>
}

const rememberedText = (environment: StepEnvironment, key: string): string | undefined => {
  const value = environment.remembered?.[key]
  return typeof value === 'string' ? value : undefined
}

const rememberedFlag = (environment: StepEnvironment, key: string): boolean | undefined => {
  const value = environment.remembered?.[key]
  return typeof value === 'boolean' ? value : undefined
}

/** A remembered multi-select answer, limited to the choices offered now. */
const rememberedList = (
  environment: StepEnvironment,
  key: string,
  choices: readonly Choice<string>[]
): string[] | undefined => {
  const value = environment.remembered?.[key]
  if (!Array.isArray(value)) return undefined
  return value.filter(
    (item): item is string =>
      typeof item === 'string' && choices.some((choice) => choice.value === item)
  )
}

export interface WizardStep {
  key: keyof WizardAnswers
  /** Name on the review screen and in the "Edit an answer" menu. */
  label: string
  applies: (answers: WizardAnswers, environment: StepEnvironment) => boolean
  /** A select step's compatible options; with exactly one, it is taken without asking. */
  options?: (answers: WizardAnswers, environment: StepEnvironment) => Choice<string>[]
  ask: (
    prompter: Prompter,
    answers: WizardAnswers,
    environment: StepEnvironment
  ) => Promise<WizardAnswers>
  describe: (answers: WizardAnswers, environment: StepEnvironment) => string
  modules: (answers: WizardAnswers) => string[]
  /** Module options this answer sets, e.g. the rate-limit algorithm. */
  moduleOptions?: (answers: WizardAnswers) => Record<string, Record<string, unknown>>
}

/** Always configured, never asked (D-35). */
export const ALWAYS_INCLUDED = ['language-node', 'quality-eslint', 'quality-prettier']
export const ALWAYS_INCLUDED_LABEL = 'TypeScript, ESLint, Prettier'

const NONE = 'none'

const FULLSTACK = 'fullstack'

const APP_TYPES: Choice<string>[] = [
  { value: 'backend', label: 'Backend' },
  { value: FULLSTACK, label: 'Fullstack', hint: 'API + Next.js web app in a monorepo' }
]
/** Question 7b (D-38): social sign-in through Better Auth; credentials stay blank in .env. */
const OAUTH_PROVIDERS: Choice<string>[] = [
  { value: 'github', label: 'GitHub' },
  { value: 'google', label: 'Google' }
]

interface MultiselectStepDefinition {
  key: 'appSetup' | 'repoExtras'
  label: string
  message: string
  applies: (answers: WizardAnswers) => boolean
  required?: boolean
}

/** A multi-select of the modules that declare this question; their `checked` is the default. */
function multiselectStep(definition: MultiselectStepDefinition): WizardStep {
  const { key } = definition
  return {
    key,
    label: definition.label,
    applies: (answers) => definition.applies(answers),
    ask: async (prompter, answers, environment) => {
      const choices = moduleChoices(environment.registry, key)
      const selected = await prompter.multiselect({
        message: definition.message,
        choices,
        initialValues:
          answers[key] ??
          rememberedList(environment, key, choices) ??
          choices.filter((choice) => choice.checked).map((choice) => choice.value),
        ...(definition.required === undefined ? {} : { required: definition.required })
      })
      return { ...answers, [key]: selected }
    },
    describe: (answers, environment) => {
      const ids = answers[key] ?? []
      const choices = moduleChoices(environment.registry, key)
      return ids.length === 0 ? 'None' : ids.map((id) => labelOf(choices, id)).join(', ')
    },
    modules: (answers) => [...(answers[key] ?? [])]
  }
}

const oauthProvidersStep: WizardStep = {
  key: 'oauthProviders',
  label: 'OAuth providers',
  applies: (answers) => answers.auth === 'auth-better-auth',
  ask: async (prompter, answers, environment) => ({
    ...answers,
    oauthProviders: await prompter.multiselect({
      message: 'OAuth providers (client id and secret go in .env later)',
      choices: OAUTH_PROVIDERS,
      initialValues:
        answers.oauthProviders ??
        rememberedList(environment, 'oauthProviders', OAUTH_PROVIDERS) ??
        [],
      required: false
    })
  }),
  describe: (answers) =>
    (answers.oauthProviders ?? []).length === 0
      ? 'None'
      : (answers.oauthProviders ?? []).map((id) => labelOf(OAUTH_PROVIDERS, id)).join(', '),
  modules: () => [],
  moduleOptions: (answers) => ({
    'auth-better-auth': Object.fromEntries(
      OAUTH_PROVIDERS.map((choice) => [
        choice.value,
        (answers.oauthProviders ?? []).includes(choice.value)
      ])
    )
  })
}
/** Question 16a (D-64): how rate limiting counts. */
const RATE_LIMIT_ALGORITHMS: Choice<string>[] = [
  { value: 'fixed-window', label: 'Fixed window', hint: 'N per window; simplest' },
  { value: 'sliding-window', label: 'Sliding window', hint: 'no bursts at window edges' },
  { value: 'token-bucket', label: 'Token bucket', hint: 'allows short bursts' },
  { value: 'leaky-bucket', label: 'Leaky bucket', hint: 'constant rate' }
]

const labelOf = (choices: Choice<string>[], value: string | undefined): string =>
  choices.find((choice) => choice.value === value)?.label ?? value ?? '—'

const yesNo = (value: boolean | undefined): string => (value === true ? 'Yes' : 'No')

const isModule = (value: string | undefined): value is string =>
  value !== undefined && value !== NONE

/** The "no module" answer of a module question, e.g. pino as the logger. */
interface NoneChoice {
  label: string
  hint?: string
  first?: boolean
}

interface SelectStepDefinition {
  key:
    | 'appType'
    | 'framework'
    | 'frontend'
    | 'styling'
    | 'frontendArchitecture'
    | 'database'
    | 'orm'
    | 'auth'
    | 'template'
    | 'logger'
    | 'architecture'
    | 'rateLimitAlgorithm'
    | 'tests'
  label: string
  message: string
  /** Fixed choices, or the modules that declare `question`; the answer is then a module id. */
  choices: Choice<string>[] | { question: WizardQuestion; none?: NoneChoice }
  defaultValue: string
  applies: (answers: WizardAnswers) => boolean
  /** Show each choice's folder tree before asking (task 3.8). */
  preview?: boolean
}

function selectStep(definition: SelectStepDefinition): WizardStep {
  const { choices } = definition
  const addsModule = !Array.isArray(choices)
  /** The modules of the question that fit the answers before this one. */
  const fittingModules = (answers: WizardAnswers, registry: Registry): Choice<string>[] => {
    if (Array.isArray(choices)) return []
    const chosen = chosenBefore(definition.key, answers)
    return moduleChoices(registry, choices.question).filter((choice) =>
      fitsStack(registry, chosen, choice.value)
    )
  }
  const options = (answers: WizardAnswers, environment: StepEnvironment): Choice<string>[] => {
    if (Array.isArray(choices)) return choices
    const modules = fittingModules(answers, environment.registry)
    if (choices.none === undefined) return modules
    const { first, ...none } = choices.none
    return first === true
      ? [{ value: NONE, ...none }, ...modules]
      : [...modules, { value: NONE, ...none }]
  }
  const allChoices = (registry: Registry): Choice<string>[] =>
    Array.isArray(choices)
      ? choices
      : [
          ...moduleChoices(registry, choices.question),
          ...(choices.none === undefined ? [] : [{ value: NONE, label: choices.none.label }])
        ]
  // an earlier answer may rule out the previous or the default value (e.g. Prisma on MongoDB)
  const initialValue = (
    choices: Choice<string>[],
    answers: WizardAnswers,
    environment: StepEnvironment
  ): string | undefined =>
    [
      answers[definition.key],
      rememberedText(environment, definition.key),
      definition.defaultValue
    ].find((value) => choices.some((choice) => choice.value === value)) ?? choices[0]?.value
  return {
    key: definition.key,
    label: definition.label,
    // a module question with no module that fits is skipped, e.g. architectures under NestJS
    applies: (answers, environment) =>
      definition.applies(answers) &&
      (!addsModule || fittingModules(answers, environment.registry).length > 0),
    options,
    ask: async (prompter, answers, environment) => {
      const choices = options(answers, environment)
      if (definition.preview === true) prompter.note(previewNote(choices), 'Folder layouts')
      const value = await prompter.select({
        message: definition.message,
        choices,
        initialValue: initialValue(choices, answers, environment)
      })
      return { ...answers, [definition.key]: value }
    },
    describe: (answers, environment) =>
      labelOf(allChoices(environment.registry), answers[definition.key]),
    modules: (answers) => {
      const value = answers[definition.key]
      return addsModule && isModule(value) ? [value] : []
    }
  }
}

interface ConfirmStepDefinition {
  key:
    'preCommit' | 'docker' | 'asyncHandler' | 'admin' | 'apiVersioning' | 'apiDocs' | 'ci' | 'redis'
  label: string
  message: string
  moduleId: string
  defaultValue: boolean
  applies?: (answers: WizardAnswers) => boolean
}

function confirmStep({
  key,
  label,
  message,
  moduleId,
  defaultValue,
  applies = () => true
}: ConfirmStepDefinition): WizardStep {
  return {
    key,
    label,
    applies: (answers, environment) =>
      applies(answers) && fitsStack(environment.registry, chosenBefore(key, answers), moduleId),
    ask: async (prompter, answers, environment) => ({
      ...answers,
      [key]: await prompter.confirm({
        message,
        initialValue: answers[key] ?? rememberedFlag(environment, key) ?? defaultValue
      })
    }),
    describe: (answers) => yesNo(answers[key]),
    modules: (answers) => (answers[key] === true ? [moduleId] : [])
  }
}

/** Every app type today has an API; fullstack adds the web app. */
const isBackend = (answers: WizardAnswers): boolean =>
  answers.appType === 'backend' || answers.appType === FULLSTACK
const isFullstack = (answers: WizardAnswers): boolean => answers.appType === FULLSTACK

/** Question 2b (D-91): how the API's code is loaded; web apps stay ESM. */
const MODULE_SYSTEM_CHOICES: Choice<ModuleSystem>[] = [
  { value: 'esm', label: 'ES modules', hint: 'import/export, "type": "module" (recommended)' },
  { value: 'cjs', label: 'CommonJS', hint: 'require() at run time, "type": "commonjs"' }
]

const moduleSystemStep: WizardStep = {
  key: 'moduleSystem',
  label: 'Module system',
  applies: (answers, environment) =>
    isModule(answers.framework) && environment.fixedModuleSystem === undefined,
  ask: async (prompter, answers, environment) => ({
    ...answers,
    moduleSystem: await prompter.select<ModuleSystem>({
      message: 'Module system (the source is TypeScript either way)',
      choices: MODULE_SYSTEM_CHOICES,
      initialValue:
        answers.moduleSystem ??
        environment.defaultModuleSystem ??
        (rememberedText(environment, 'moduleSystem') === 'cjs' ? 'cjs' : 'esm')
    })
  }),
  describe: (answers) => labelOf(MODULE_SYSTEM_CHOICES, answers.moduleSystem ?? 'esm'),
  modules: () => []
}

const packageManagerStep: WizardStep = {
  key: 'packageManager',
  label: 'Package manager',
  applies: (_answers, environment) => environment.fixedPackageManager === undefined,
  ask: async (prompter, answers, environment) => {
    const installed = environment.installedPackageManagers
    const packageManager = await prompter.select<PackageManagerId>({
      message: 'Package manager',
      choices: PACKAGE_MANAGERS.map((id) => ({
        value: id,
        label: id,
        hint: installed === undefined || installed.has(id) ? undefined : 'not installed'
      })),
      initialValue: answers.packageManager ?? environment.defaultPackageManager
    })
    return { ...answers, packageManager }
  },
  describe: (answers, environment) =>
    environment.fixedPackageManager ?? answers.packageManager ?? environment.defaultPackageManager,
  modules: () => []
}

/** 16a: asked only when rate limiting is in the app setup; sets the module's option. */
function rateLimitAlgorithmStep(): WizardStep {
  const step = selectStep({
    key: 'rateLimitAlgorithm',
    label: 'Rate-limit algorithm',
    message: 'Rate-limit algorithm',
    choices: RATE_LIMIT_ALGORITHMS,
    defaultValue: 'fixed-window',
    applies: (answers) => (answers.appSetup ?? []).includes('security-rate-limit')
  })
  return {
    ...step,
    moduleOptions: (answers): Record<string, Record<string, unknown>> =>
      answers.rateLimitAlgorithm === undefined
        ? {}
        : { 'security-rate-limit': { algorithm: answers.rateLimitAlgorithm } }
  }
}

export const STEPS: readonly WizardStep[] = [
  selectStep({
    key: 'appType',
    label: 'App type',
    message: 'App type',
    choices: APP_TYPES,
    defaultValue: 'backend',
    applies: () => true
  }),
  selectStep({
    key: 'framework',
    label: 'Framework',
    message: 'Backend framework',
    choices: { question: 'framework' },
    defaultValue: 'framework-express',
    applies: isBackend
  }),
  moduleSystemStep,
  selectStep({
    key: 'frontend',
    label: 'Frontend',
    message: 'Frontend framework',
    choices: { question: 'frontend' },
    defaultValue: 'framework-nextjs',
    applies: isFullstack
  }),
  selectStep({
    key: 'styling',
    label: 'Styling',
    message: 'Styling',
    choices: { question: 'styling', none: { label: 'Plain CSS' } },
    defaultValue: 'ui-tailwind',
    applies: isFullstack
  }),
  confirmStep({
    key: 'admin',
    label: 'Admin frontend',
    message: 'Add an admin frontend? (apps/admin on port 3002, same API)',
    moduleId: 'app-admin',
    defaultValue: false,
    // the admin app is a second Next.js app for now (D-64, D-79); app-admin requires it
    applies: isFullstack
  }),
  selectStep({
    key: 'frontendArchitecture',
    label: 'Frontend architecture',
    message: 'Frontend architecture',
    choices: { question: 'frontendArchitecture' },
    preview: true,
    defaultValue: 'arch-web-feature',
    applies: isFullstack
  }),
  selectStep({
    key: 'database',
    label: 'Database',
    message: 'Database',
    choices: { question: 'database', none: { label: 'None' } },
    defaultValue: 'database-postgres',
    applies: isBackend
  }),
  selectStep({
    key: 'orm',
    label: 'ORM',
    message: 'ORM',
    // only the ORMs the database supports, e.g. Mongoose on MongoDB
    choices: { question: 'orm' },
    defaultValue: 'orm-prisma',
    applies: (answers) => isModule(answers.database)
  }),
  confirmStep({
    key: 'redis',
    label: 'Redis',
    message: 'Add Redis (cache, sessions)?',
    moduleId: 'cache-redis',
    defaultValue: false,
    applies: (answers) => isModule(answers.framework)
  }),
  selectStep({
    key: 'auth',
    label: 'Auth',
    message: 'Authentication',
    // the auth modules require Prisma on Postgres for now (M3, M4, D-77)
    choices: { question: 'auth', none: { label: 'None', first: true } },
    defaultValue: NONE,
    applies: (answers) => isModule(answers.framework)
  }),
  oauthProvidersStep,
  selectStep({
    key: 'logger',
    label: 'Logger',
    message: 'Logger',
    choices: {
      question: 'logger',
      none: { label: 'pino', hint: 'fast JSON logs (recommended)', first: true }
    },
    defaultValue: NONE,
    applies: (answers) => isModule(answers.framework)
  }),
  selectStep({
    key: 'template',
    label: 'App template',
    message: 'App template',
    // Todo requires Express and Prisma on Postgres for now (M3, D-77)
    choices: { question: 'template', none: { label: 'None (clean setup)', first: true } },
    defaultValue: NONE,
    applies: (answers) => isModule(answers.framework)
  }),
  packageManagerStep,
  selectStep({
    key: 'architecture',
    label: 'Architecture',
    message: 'Backend architecture',
    choices: { question: 'architecture' },
    preview: true,
    defaultValue: 'arch-feature',
    applies: (answers) => isModule(answers.framework)
  }),
  confirmStep({
    key: 'preCommit',
    label: 'Pre-commit hooks',
    message: 'Add pre-commit hooks? (Husky, lint-staged, commitlint)',
    moduleId: 'quality-husky',
    defaultValue: true
  }),
  selectStep({
    key: 'tests',
    label: 'Tests',
    message: 'Test runner',
    choices: {
      question: 'tests',
      none: { label: "Node's built-in test runner", hint: 'node --test, no extra dependency' }
    },
    defaultValue: 'testing-vitest',
    applies: (answers) => isModule(answers.framework)
  }),
  confirmStep({
    key: 'docker',
    label: 'Docker',
    message: 'Add a Dockerfile and docker compose?',
    moduleId: 'devops-docker',
    defaultValue: true
  }),
  confirmStep({
    key: 'apiDocs',
    label: 'API docs',
    message: 'Add API docs? (Scalar at /docs, OpenAPI at /openapi.json)',
    moduleId: 'api-docs-scalar',
    defaultValue: true,
    // the Nest variant (@nestjs/swagger) comes later
    applies: (answers) => isModule(answers.framework)
  }),
  multiselectStep({
    key: 'appSetup',
    label: 'App setup',
    message: 'App setup (app.ts)',
    applies: (answers) => isModule(answers.framework)
  }),
  rateLimitAlgorithmStep(),
  confirmStep({
    key: 'apiVersioning',
    label: 'API versioning',
    message: 'Version the API under /v1? (health routes stay unversioned)',
    moduleId: 'api-versioning',
    defaultValue: true,
    applies: (answers) => isModule(answers.framework)
  }),
  confirmStep({
    key: 'ci',
    label: 'CI',
    message: 'Add GitHub Actions CI? (lint, format, typecheck, build, test)',
    moduleId: 'devops-github-actions',
    defaultValue: true
  }),
  confirmStep({
    key: 'asyncHandler',
    label: 'asyncHandler',
    message:
      'Add an asyncHandler() wrapper for routes? (Express 5 forwards async errors without it)',
    moduleId: 'middleware-async-handler',
    defaultValue: false,
    // the wrapper requires Express
    applies: (answers) => isModule(answers.framework)
  }),
  multiselectStep({
    key: 'repoExtras',
    label: 'Repo extras',
    message: 'Repo extras',
    applies: () => true,
    required: false
  })
]

/** Options the answers set, per module id; steps that do not apply set nothing. */
export function moduleOptionsFromAnswers(
  answers: WizardAnswers,
  registry: Registry
): Record<string, Record<string, unknown>> {
  const environment: StepEnvironment = { registry, defaultPackageManager: 'npm' }
  return Object.assign(
    {},
    ...STEPS.filter((step) => step.applies(answers, environment)).map(
      (step) => step.moduleOptions?.(answers) ?? {}
    )
  ) as Record<string, Record<string, unknown>>
}

/** The stack the answers describe; steps that do not apply add nothing. */
export function modulesFromAnswers(answers: WizardAnswers, registry: Registry): string[] {
  const environment: StepEnvironment = { registry, defaultPackageManager: 'npm' }
  const chosen = STEPS.filter((step) => step.applies(answers, environment)).flatMap((step) =>
    step.modules(answers)
  )
  // a fullstack app lives in a monorepo: apps/api, apps/web, packages/shared (B8)
  const layout = isFullstack(answers) ? ['layout-monorepo'] : []
  // Vitest for the API also tests the web apps
  // tests and Docker images for the API extend to the web apps
  const webExtras = isFullstack(answers)
    ? [
        ...(chosen.includes('testing-vitest') ? ['testing-vitest-web'] : []),
        ...(chosen.includes('devops-docker') ? ['devops-docker-web'] : [])
      ]
    : []
  return [...new Set([...ALWAYS_INCLUDED, ...layout, ...chosen, ...webExtras])]
}

/**
 * The modules the answers before `key` choose, which a choice must fit. Earlier steps are taken
 * as answered, without asking whether they apply, so no step depends on a later one.
 */
function chosenBefore(key: keyof WizardAnswers, answers: WizardAnswers): string[] {
  const index = STEPS.findIndex((step) => step.key === key)
  return [
    ...ALWAYS_INCLUDED,
    ...(isFullstack(answers) ? ['layout-monorepo'] : []),
    ...STEPS.slice(0, index).flatMap((step) => step.modules(answers))
  ]
}

/** The selected modules that answer a question, in the question's order. */
const selectedFor = (
  modules: readonly string[],
  registry: Registry,
  question: WizardQuestion
): string[] =>
  moduleChoices(registry, question)
    .map((choice) => choice.value)
    .filter((id) => modules.includes(id))

/** Pre-fills every answer from a module list, e.g. a preset (A0.2 #0). */
export function answersFromModules(modules: readonly string[], registry: Registry): WizardAnswers {
  // the last selected choice wins: a later one builds on an earlier one (sessions on JWT)
  const select = (question: WizardQuestion): string | undefined =>
    selectedFor(modules, registry, question).at(-1)
  const frontend = select('frontend')
  return {
    appType: frontend === undefined ? 'backend' : FULLSTACK,
    framework: select('framework'),
    frontend,
    styling: frontend === undefined ? undefined : (select('styling') ?? NONE),
    admin: modules.includes('app-admin'),
    frontendArchitecture: select('frontendArchitecture'),
    apiVersioning: modules.includes('api-versioning'),
    tests: select('tests') ?? NONE,
    apiDocs: modules.includes('api-docs-scalar'),
    ci: modules.includes('devops-github-actions'),
    // a module list carries no options: a preset with rate limiting starts from the default
    rateLimitAlgorithm: modules.includes('security-rate-limit') ? 'fixed-window' : undefined,
    database: select('database') ?? NONE,
    orm: select('orm'),
    redis: modules.includes('cache-redis'),
    auth: select('auth') ?? NONE,
    // a module list carries no options: providers start unselected
    oauthProviders: [],
    template: select('template') ?? NONE,
    logger: select('logger') ?? NONE,
    repoExtras: selectedFor(modules, registry, 'repoExtras'),
    architecture: select('architecture') ?? 'arch-flat',
    preCommit: modules.includes('quality-husky'),
    docker: modules.includes('devops-docker'),
    asyncHandler: modules.includes('middleware-async-handler'),
    appSetup: selectedFor(modules, registry, 'appSetup')
  }
}
